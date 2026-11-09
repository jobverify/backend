import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import PipelineRun from '../src/models/PipelineRun.js';
import { matchesGithubStage, reconcileGithub } from '../src/pipeline/github.js';

const stage = { key: 'scraper', dispatchToken: 'expected-dispatch-token' };
const workflows = [
  { key: 'scraper', label: 'Scraper', file: 'scraper.yml' },
  { key: 'rewrite', label: 'Description Rewrite', file: 'rewrite-descriptions.yml' },
  { key: 'classification', label: 'Job Classification', file: 'classify-jobs.yml' },
];

for (const { key, label } of workflows) {
  test(`readable ${key} job names retain exact identity in step metadata`, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ jobs: [{
      name: label, steps: [{ name: `${label} [dispatch:${stage.dispatchToken}]` }],
    }] }));
    assert.equal(await matchesGithubStage('owner/jobs', { id: 31, display_title: `${label} #31` }, { ...stage, key }, 'test-token'), true);
  });

  test(`clean ${key} titles retain exact dispatch identity in job metadata`, async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async url => {
      calls.push(String(url));
      return Response.json({ jobs: [{ name: `${label} [dispatch:${stage.dispatchToken}]` }] });
    });
    assert.equal(await matchesGithubStage('owner/jobs', { id: 31, display_title: `${label} #31` }, { ...stage, key }, 'test-token'), true);
    assert.deepEqual(calls, ['https://api.github.com/repos/owner/jobs/actions/runs/31/jobs?per_page=100']);
  });

  test(`unrelated job tokens never claim a clean ${key} run`, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ jobs: [
      { name: `${label} [dispatch:other-token]` },
      { name: `${label} [dispatch:${stage.dispatchToken}-suffix]` },
      { name: `Other Stage [dispatch:${stage.dispatchToken}]` },
      { name: label, steps: [{ name: `${label} [dispatch:${stage.dispatchToken}-suffix]` }, { name: `Other Stage [dispatch:${stage.dispatchToken}]` }] },
    ] }));
    assert.equal(await matchesGithubStage('owner/jobs', { id: 32, display_title: `${label} #32` }, { ...stage, key }, 'test-token'), false);
  });

  test(`queued ${key} runs remain unmatched until job metadata appears`, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ jobs: [] }));
    assert.equal(await matchesGithubStage('owner/jobs', { id: 33, display_title: `${label} #33` }, { ...stage, key }, 'test-token'), false);
  });
}

test('legacy titles still match without querying jobs', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('legacy identity needs no job request'));
  for (const key of ['scraper', 'rewrite', 'classification']) {
    assert.equal(await matchesGithubStage('owner/jobs', { display_title: `${key} | pipeline | ${stage.dispatchToken}` }, { ...stage, key }, 'test-token'), true);
  }
  assert.equal(await matchesGithubStage('owner/jobs', { display_title: 'Scraper #31' }, { key: 'scraper' }, 'test-token'), false);
  assert.equal(await matchesGithubStage('owner/jobs', { display_title: 'Rewrite | unrelated' }, { ...stage, key: 'rewrite' }, 'test-token'), false);
});

test('workflow titles are readable while jobs preserve stage correlation', () => {
  for (const { label, file } of workflows) {
    const workflow = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');
    assert.ok(workflow.includes("run-name: '" + label + " #${{ github.run_number }}'"));
    assert.ok(workflow.includes("format('" + label + " [dispatch:{0}]', inputs.dispatch_token)"));
    assert.doesNotMatch(workflow, /^    name:.*dispatch_token/m);
  }
  const coordinator = readFileSync(new URL('../.github/workflows/pipeline-completion.yml', import.meta.url), 'utf8');
  assert.match(coordinator, /^name: Jobverify Pipeline Coordinator$/m);
  assert.match(coordinator, /^run-name: 'Pipeline Coordinator #\$\{\{ github.run_number \}\}'$/m);
});

// Exercise the real transition code with an in-memory persistence boundary.
function queuedPipeline(t, key = 'scraper') {
  let row = { _id: 'pipeline', revision: 0, activeKey: 'database', target: 'github',
    repo: 'owner/jobs', status: 'running', stages: [
      { ...stage, key, status: 'queued', queuedAt: new Date() },
      { key: key === 'rewrite' ? 'classification' : 'rewrite', status: 'waiting' },
    ] };
  t.mock.method(PipelineRun, 'findById', () => ({ lean: async () => structuredClone(row) }));
  t.mock.method(PipelineRun, 'findOne', filter => ({ lean: async () => {
    if (filter.activeKey || row.stages.some(s => s.githubRunId === filter['stages.githubRunId'])) return structuredClone(row);
    return null;
  } }));
  t.mock.method(PipelineRun, 'findOneAndUpdate', (filter, update) => ({ lean: async () => {
    assert.equal(filter.revision, row.revision);
    Object.assign(row, structuredClone(update.$set));
    for (const key of Object.keys(update.$unset || {})) delete row[key];
    return structuredClone(row);
  } }));
  return () => structuredClone(row);
}

for (const { key, label, file } of workflows) {
  test(`reconciliation binds the correct clean ${key} run and releases an early failure`, async t => {
    const snapshot = queuedPipeline(t, key);
    t.mock.method(globalThis, 'fetch', async url => {
      if (url.includes('/workflows/')) return Response.json({ workflow_runs: [
        { id: 40, display_title: `${label} #40`, status: 'completed', conclusion: 'failure' },
        { id: 39, display_title: `${label} #39`, status: 'completed', conclusion: 'failure' },
      ] });
      if (url.includes('/40/jobs')) return Response.json({ jobs: [{ name: `${label} [dispatch:unrelated]` }] });
      if (url.includes('/39/jobs')) return Response.json({ jobs: [{ name: label, steps: [{ name: `${label} [dispatch:${stage.dispatchToken}]` }] }] });
      assert.fail(`Unexpected GitHub request: ${url}`);
    });
    await reconcileGithub(snapshot(), { token: 'test-token' });
    const stopped = snapshot();
    assert.equal(stopped.stages[0].githubRunId, 39);
    assert.equal(stopped.status, 'failed');
    assert.equal(stopped.activeKey, undefined);
    assert.equal(stopped.stages[1].status, 'blocked');
  });

  test(`completion CLI correlates a clean ${key} failure before registration`, async t => {
    const snapshot = queuedPipeline(t, key);
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-identity-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const eventFile = path.join(directory, 'event.json');
    await fs.writeFile(eventFile, JSON.stringify({ repository: { default_branch: 'main' },
      workflow_run: { id: 41, name: `${label} #41`, path: `.github/workflows/${file}`,
        head_branch: 'main', display_title: `${label} #41` } }));
    const previousArgv = process.argv;
    const previousEvent = process.env.GITHUB_EVENT_PATH;
    const previousToken = process.env.GH_TOKEN;
    t.after(() => {
      process.argv = previousArgv;
      if (previousEvent === undefined) delete process.env.GITHUB_EVENT_PATH;
      else process.env.GITHUB_EVENT_PATH = previousEvent;
      if (previousToken === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = previousToken;
    });
    process.argv = [process.execPath, 'pipelineGithub.js', 'complete'];
    process.env.GITHUB_EVENT_PATH = eventFile;
    process.env.GH_TOKEN = 'test-token';
    t.mock.method(mongoose, 'connect', async () => {});
    t.mock.method(mongoose, 'disconnect', async () => {});
    t.mock.method(globalThis, 'fetch', async url => {
      if (url.endsWith('/41/jobs?per_page=100')) return Response.json({ jobs: [{ name: label, steps: [{ name: `${label} [dispatch:${stage.dispatchToken}]` }] }] });
      if (url.endsWith('/actions/runs/41')) return Response.json({ id: 41, status: 'completed', conclusion: 'failure' });
      assert.fail(`Unexpected GitHub request: ${url}`);
    });
    await import(`../scripts/pipelineGithub.js?identity=${key}`);
    assert.equal(snapshot().stages[0].githubRunId, 41);
    assert.equal(snapshot().status, 'failed');
    assert.equal(snapshot().activeKey, undefined);
    assert.equal(snapshot().stages[1].status, 'blocked');
  });
}
