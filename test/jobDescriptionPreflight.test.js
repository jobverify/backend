import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const directoryFor = async t => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'rewrite-preflight-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
};
const modelFor = async (t, change = source => source) => {
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: JSON.stringify(body.messages) }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
      content: JSON.stringify({ text: change(body.messages.at(-1).content) }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
};

for (const ready of [true, false]) test(`preflight ${ready ? 'passes' : 'rejects'} through real validation and closes its worker`, async t => {
  const { runRewritePreflight } = await import('../rewriting/preflight.js');
  const outputDirectory = await directoryFor(t);
  const endpoint = await modelFor(t, source => ready ? source : source.replaceAll('Python', 'Java'));
  let stopped = false;
  const result = await runRewritePreflight({ outputDirectory,
    env: { JOB_DESCRIPTION_REWRITE_CONCURRENCY: '4', JOB_DESCRIPTION_REWRITE_CPU_THREADS: '4' },
    prepareRuntime: async () => ({ binary: 'verified-test-runtime', modelFile: 'verified-test-model' }),
    startWorker: async options => ({ endpoint, model: 'test-model', parallelism: options.parallelism,
      stop: async () => { stopped = true; } }),
  });
  assert.equal(stopped, true);
  assert.equal(result.ready, ready);
  assert.equal(result.workerProbe.requests, 4);
  assert.equal(result.workerProbe.generationRequests, ready ? 4 : 8);
  assert.equal(result.rejectionDiagnostics.totalRejected, ready ? 0 : 4);
  assert.equal(result.reason, ready ? undefined : 'model_quality_unavailable');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(outputDirectory, 'description-readiness.json'), 'utf8')), result);
  const rejected = JSON.parse(await fs.readFile(path.join(outputDirectory, 'description-readiness-rejections.json'), 'utf8'));
  assert.equal(rejected.totalRejected, ready ? 0 : 4);
});

test('preflight retains startup failure diagnostics', async t => {
  const { runRewritePreflight } = await import('../rewriting/preflight.js');
  const outputDirectory = await directoryFor(t);
  const result = await runRewritePreflight({ outputDirectory, env: {},
    prepareRuntime: async () => { throw new Error('Verified runtime unavailable'); },
  });
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'worker_error');
  assert.match(result.error.message, /Verified runtime unavailable/);
  assert.equal(JSON.parse(await fs.readFile(path.join(outputDirectory, 'description-readiness.json'))).ready, false);
});

test('preflight reports cleanup failure even after accepted probes', async t => {
  const { runRewritePreflight } = await import('../rewriting/preflight.js');
  const outputDirectory = await directoryFor(t);
  const endpoint = await modelFor(t);
  const result = await runRewritePreflight({ outputDirectory, env: {}, prepareRuntime: async () => ({}),
    startWorker: async () => ({ endpoint, parallelism: 1, stop: async () => { throw new Error('Unable to stop worker'); } }),
  });
  assert.equal(result.workerProbe.ready, true);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'worker_error');
  assert.match(result.error.message, /Unable to stop worker/);
});

test('preflight CLI exits unsuccessfully and saves diagnostics when the required custom runtime is missing', async t => {
  const cwd = await directoryFor(t);
  const script = fileURLToPath(new URL('../scripts/checkDescriptionReadiness.js', import.meta.url));
  const env = { ...process.env, JOB_DESCRIPTION_REWRITE_REQUIRE_CUSTOM_BINARY: '1' };
  delete env.JOB_DESCRIPTION_REWRITE_BINARY;
  delete env.JOB_DESCRIPTION_REWRITE_BINARY_SHA256;
  delete env.GITHUB_STEP_SUMMARY;
  await assert.rejects(exec(process.execPath, [script], { cwd, env, windowsHide: true }), error => {
    assert.equal(error.code, 1);
    assert.equal(JSON.parse(error.stdout.trim()).ready, false);
    return true;
  });
  const summary = JSON.parse(await fs.readFile(path.join(cwd, '.cache/scraper-actions/description-readiness.json')));
  assert.equal(summary.reason, 'worker_error');
  assert.match(summary.error.message, /verified portable runtime/);
});
