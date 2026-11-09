import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ResumeUsage from '../src/models/ResumeUsage.js';
import Resume from '../src/models/Resume.js';
import TailoredResume from '../src/models/TailoredResume.js';
import { recoverResumePreparations } from '../src/services/resumePreparationService.js';
import { recoverTailoredResumes } from '../src/services/resumeTailoringService.js';
import { dispatchTailoredResumes, tailoredResumeActionsConfigured } from '../src/services/resumeTailoringWorkflow.js';

function configure(t, values = {}) {
  const config = { GITHUB_PAT: 'test-token-only', GITHUB_REPO: 'example/backend', 
    TAILORED_RESUME_ACTIONS_ENABLED: 'true', TAILORED_RESUME_ACTIONS_MONTHLY_RUN_LIMIT: '10', ...values };
  for (const [key, value] of Object.entries(config)) {
    const before = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  t.mock.method(ResumeUsage, 'updateOne', async () => ({}));
  t.mock.method(ResumeUsage, 'findOneAndUpdate', async () => ({ used: 1 }));
}

test('tailoring dispatches its own workflow on the default branch with no candidate data or free API gate', async t => {
  configure(t, { TAILORED_RESUME_ACTIONS_ENABLED: undefined });
  const calls = [];
  const result = await dispatchTailoredResumes({ now: new Date('2026-10-20'), request: async (repo, endpoint, options) => {
    assert.equal(repo, 'example/backend');
    calls.push({ endpoint, options });
    if (endpoint.includes('/runs?')) return { workflow_runs: [] };
    if (!endpoint) return { default_branch: 'production' };
    assert.equal(endpoint, '/actions/workflows/tailored-resumes.yml/dispatches');
    assert.deepEqual(options, { method: 'POST', body: { ref: 'production' } });
  } });
  assert.equal(tailoredResumeActionsConfigured(), true);
  assert.equal(result.reused, false);
  assert.equal(calls.length, 3);
  assert.match(calls[0].endpoint, /tailored-resumes\.yml\/runs/);
});

test('a waiting runner is reused, while a running worker gets a follow-up run for newly queued work', async t => {
  configure(t);
  for (const status of ['queued', 'waiting', 'pending', 'requested', 'in_progress', 'completed']) {
    let posts = 0;
    const result = await dispatchTailoredResumes({ request: async (_repo, endpoint, options) => {
      if (endpoint.includes('/runs?')) return { workflow_runs: [{ status }] };
      if (!endpoint) return { default_branch: 'main' };
      if (options?.method === 'POST') posts++;
    } });
    assert.equal(result.reused, !['in_progress', 'completed'].includes(status), status);
    assert.equal(posts, result.reused ? 0 : 1, status);
  }
});

test('simultaneous requests share one dispatch while GitHub has not listed the new run yet', async t => {
  configure(t);
  let posts = 0;
  const request = async (_repo, endpoint) => {
    if (endpoint.includes('/runs?')) return { workflow_runs: [] };
    if (!endpoint) return { default_branch: 'main' };
    posts++;
  };
  await Promise.all(Array.from({ length: 6 }, () => dispatchTailoredResumes({ request })));
  assert.equal(posts, 1);
});

test('recovery does not start a second workflow while an existing worker is setting up', async t => {
  configure(t);
  t.mock.method(Resume, 'updateMany', async () => ({}));
  t.mock.method(Resume, 'exists', async () => ({ _id: 'queued-base' }));
  t.mock.method(TailoredResume, 'updateMany', async () => ({}));
  let posts = 0;
  const request = async (_repo, endpoint, options) => {
    if (endpoint.includes('/runs?')) return { workflow_runs: [{ status: 'in_progress' }] };
    if (!endpoint) return { default_branch: 'main' };
    if (options?.method === 'POST') posts++;
  };
  const dispatch = options => dispatchTailoredResumes({ ...options, request });
  await recoverResumePreparations({ dispatch });
  await recoverTailoredResumes({ dispatch });
  assert.equal(posts, 0, 'an aged queued base request is already covered by the active worker');
});

test('recovery starts a replacement after the previous workflow ends', async t => {
  configure(t);
  let posts = 0;
  const result = await dispatchTailoredResumes({ reuseRunning: true, request: async (_repo, endpoint, options) => {
    if (endpoint.includes('/runs?')) return { workflow_runs: [{ status: 'completed' }] };
    if (!endpoint) return { default_branch: 'main' };
    if (options?.method === 'POST') posts++;
  } });
  assert.equal(result.reused, false);
  assert.equal(posts, 1);
});

test('missing configuration and explicit disablement reject before GitHub or quota calls', async t => {
  for (const values of [{ GITHUB_PAT: undefined }, { GITHUB_REPO: 'invalid' }, { TAILORED_RESUME_ACTIONS_ENABLED: 'false' }]) {
    await t.test(JSON.stringify(values), async t => {
      configure(t, values);
      assert.equal(tailoredResumeActionsConfigured(), false);
      await assert.rejects(dispatchTailoredResumes({ request: async () => assert.fail('GitHub must not be called') }), { statusCode: 503 });
      assert.equal(ResumeUsage.updateOne.mock.callCount(), 0);
    });
  }
});

test('dispatch ignores retired monthly caps and exhausted historical usage', async t => {
  configure(t, { TAILORED_RESUME_ACTIONS_MONTHLY_RUN_LIMIT: '0' });
  t.mock.method(ResumeUsage, 'findOneAndUpdate', async () => assert.fail('dispatch must not reserve monthly usage'));
  let posts = 0;
  await dispatchTailoredResumes({ request: async (_repo, endpoint, options) => {
    if (options?.method === 'POST') { posts++; return; }
    return endpoint ? { workflow_runs: [] } : { default_branch: 'main' };
  } });
  assert.equal(posts, 1);
  assert.equal(ResumeUsage.updateOne.mock.callCount(), 0);
});

test('invalid GitHub responses and failed dispatches are retryable and do not leak upstream details', async t => {
  configure(t);
  for (const request of [async () => ({}), async (_repo, endpoint) => endpoint ? { workflow_runs: [] } : {}, async () => { throw Error('private upstream response'); }]) {
    await assert.rejects(dispatchTailoredResumes({ request }), error => error.statusCode >= 500 && !/private upstream/.test(error.message));
  }
  let posts = 0;
  await dispatchTailoredResumes({ request: async (_repo, endpoint) => {
    if (endpoint.includes('/runs?')) return { workflow_runs: [] };
    if (!endpoint) return { default_branch: 'main' };
    posts++;
  } });
  assert.equal(posts, 1, 'a rejected dispatch must release the in-process lock');
});

test('dedicated AI workflow caches pinned model and compiler dependencies on CPU runners', async () => {
  const workflow = await readFile(new URL('../.github/workflows/tailored-resumes.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /group: jobverify-tailored-resumes/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /timeout-minutes: 30/);
  assert.match(workflow, /timeout-minutes: 28/);
  assert.match(workflow, /sparse-checkout:/);
  assert.match(workflow, /cache: 'npm'/);
  assert.match(workflow, /\.cache\/resume-models\/Qwen3-4B-Instruct-2507-Q4_K_M\.gguf/);
  assert.match(workflow, /\.cache\/resume-runtime\/b11146\/llama-b11146-bin-ubuntu-x64\.tar\.gz/);
  assert.match(workflow, /\.cache\/resume-compiler\/image\.tar/);
  assert.match(workflow, /actions\/cache\/restore@/);
  assert.match(workflow, /actions\/cache\/save@/);
  assert.match(workflow, /secrets\.MONGO_URI/);
  assert.match(workflow, /node scripts\/runTailoredResumes\.js/);
  assert.doesNotMatch(workflow, /upload-artifact|GITHUB_PAT|INFERENCE_API|OPENAI_API/);
});

test('sparse worker checkout covers the complete local import closure and its font resources', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const workflow = await readFile(path.join(root, '.github/workflows/tailored-resumes.yml'), 'utf8');
  const block = workflow.match(/sparse-checkout: \|\r?\n((?:[ \t]{12}[^\r\n]+\r?\n)+)/);
  assert.ok(block, 'the worker must declare its checkout paths');
  const includedPaths = block[1].trim().split(/\r?\n/).map(value => value.trim().replace(/^\//, ''));
  const included = file => includedPaths.some(pattern => pattern.endsWith('/') ? file.startsWith(pattern) : file === pattern);
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const relative = path.relative(root, file).replaceAll('\\', '/');
    assert.ok(included(relative), `worker import missing from sparse checkout: ${relative}`);
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/(?:from\s+|import\(\s*)['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const imported = path.resolve(path.dirname(file), match[1]);
      assert.ok(existsSync(imported), `missing worker module: ${match[1]}`);
      await visit(imported);
    }
  }
  await visit(path.join(root, 'scripts/runTailoredResumes.js'));
  assert.ok(visited.size > 20);
  for (const file of ['package.json', 'package-lock.json', 'resume-tailoring/fonts/manifest.json', 'src/services/resumeTextWorker.js']) assert.ok(included(file));
});

test('worker budget includes setup time and reserves cleanup time within its Actions job', async () => {
  const budget = await import('../resume-tailoring/resumeBudget.js');
  assert.equal(typeof budget.resumeWorkerDeadline, 'function');
  const now = Date.parse('2026-11-01T15:00:30Z');
  assert.equal(budget.RESUME_WORKER_BUDGET_MS, 28 * 60000);
  assert.equal(budget.resumeWorkerDeadline('2026-11-01T15:00:00Z', now), now + 28 * 60000 - 30000);
  assert.equal(budget.resumeWorkerDeadline(undefined, now), now + 28 * 60000);
  assert.equal(budget.resumeWorkerDeadline('2026-11-01T16:00:00Z', now), now + 28 * 60000);
});
