import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import PipelineRun from '../src/models/PipelineRun.js';

function cliContext(t, command) {
  const argv = process.argv, env = { ...process.env }, exitCode = process.exitCode;
  process.argv = [process.execPath, 'pipelineGithub.js', command];
  const messages = [];
  t.mock.method(console, 'error', (...args) => messages.push(args.join(' ')));
  t.mock.method(console, 'log', (...args) => messages.push(args.join(' ')));
  t.mock.method(mongoose, 'disconnect', async () => {});
  t.after(() => {
    process.argv = argv;
    process.exitCode = exitCode;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  });
  return messages;
}

test('completion errors expose the failing command and underlying cause while redacting credentials', async t => {
  const messages = cliContext(t, 'complete');
  process.env.GH_TOKEN = 'test-secret-token';
  t.mock.method(mongoose, 'connect', async () => {
    throw Object.assign(new Error('querySrv failed for mongodb+srv://user:password@cluster/db test-secret-token'), {
      code: 'ECONNREFUSED', cause: new Error('DNS resolver refused the request'),
    });
  });
  await import('../scripts/pipelineGithub.js?diagnostic=connection');
  assert.equal(process.exitCode, 1);
  const output = messages.join('\n');
  assert.match(output, /complete/);
  assert.match(output, /querySrv failed/);
  assert.match(output, /ECONNREFUSED/);
  assert.match(output, /DNS resolver refused/);
  assert.doesNotMatch(output, /password|test-secret-token|mongodb\+srv:\/\//);
});

for (const jobResult of ['success', 'failure', 'incomplete']) {
test(`report preserves source warnings and respects the ${jobResult} workflow result`, async t => {
  const messages = cliContext(t, 'report');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-diagnostics-'));
  const cwd = process.cwd();
  t.after(async () => { process.chdir(cwd); await fs.rm(directory, { recursive: true, force: true }); });
  process.chdir(directory);
  process.env.PIPELINE_STAGE = 'scraper';
  process.env.PIPELINE_JOB_RESULT = jobResult === 'incomplete' ? 'success' : jobResult;
  process.env.GITHUB_RUN_ID = '31';
  await fs.mkdir('.cache/scraper-actions', { recursive: true });
  await fs.writeFile('.cache/scraper-actions/pipeline-scraper-summary.json', JSON.stringify({
    scanned: 4654, completed: 4318, failed: 10, warnings: 10,
    ...(jobResult === 'incomplete' ? { pendingEstimate: 1 } : {}),
  }));
  t.mock.method(mongoose, 'connect', async () => {});
  t.mock.method(PipelineRun, 'findOne', () => ({ lean: async () => ({ _id: 'pipeline' }) }));
  t.mock.method(PipelineRun, 'findById', () => ({ lean: async () => ({
    _id: 'pipeline', revision: 0, activeKey: 'database', status: 'running',
    stages: [{ key: 'scraper', status: 'running', githubRunId: 31 }],
  }) }));
  t.mock.method(PipelineRun, 'findOneAndUpdate', (_filter, update) => ({ lean: async () => {
    assert.equal(update.$set.stages[0].processingOutcome, jobResult === 'success' ? 'completed' : jobResult === 'incomplete' ? 'incomplete' : 'failed');
    assert.equal(update.$set.stages[0].summary.failed, 10);
    assert.equal(update.$set.stages[0].summary.warnings, 10);
    return update.$set;
  } }));
  await import(`../scripts/pipelineGithub.js?diagnostic=report-${jobResult}`);
  assert.equal(process.exitCode, jobResult === 'success' ? undefined : 1);
  const output = messages.join('\n');
  assert.match(output, new RegExp(`scraper.*${jobResult === 'success' ? 'completed' : jobResult === 'incomplete' ? 'incomplete' : 'failed'}`));
  assert.match(output, /"failed":10/);
  assert.match(output, /"scanned":4654/);
});
}
