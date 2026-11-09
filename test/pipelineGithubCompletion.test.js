import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import PipelineRun from '../src/models/PipelineRun.js';

for (const [workflowPath, expectedExit] of [
  ['.github/workflows/scraper.yml', undefined],
  ['.github/workflows/unrelated.yml', 1],
]) {
  test(`completion validates workflow path ${workflowPath} independently of a custom run name`, async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-completion-'));
    const eventFile = path.join(directory, 'event.json');
    const argv = process.argv, env = { ...process.env }, exitCode = process.exitCode;
    t.after(async () => {
      process.argv = argv; process.exitCode = exitCode;
      for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
      Object.assign(process.env, env);
      await fs.rm(directory, { recursive: true, force: true });
    });
    process.argv = [process.execPath, 'pipelineGithub.js', 'complete'];
    process.env.GITHUB_EVENT_PATH = eventFile;
    process.env.GH_TOKEN = 'test-token';
    process.exitCode = undefined;
    const remote = { id: 39164501657, name: workflowPath.includes('unrelated') ? 'Jobverify Scraper Cron'
      : 'Scraper | pipeline-id | dispatch-token', display_title: 'Scraper | pipeline-id | dispatch-token',
      path: workflowPath, head_branch: 'main', status: 'completed', conclusion: 'failure' };
    await fs.writeFile(eventFile, JSON.stringify({ repository: { default_branch: 'main' }, workflow_run: remote }));
    let row = { _id: 'pipeline-id', revision: 0, activeKey: 'database', status: 'running', repo: 'owner/jobs',
      target: 'github', stages: [
        { key: 'scraper', status: 'running', githubRunId: remote.id, processingOutcome: 'failed', summary: { failed: 10 } },
        { key: 'rewrite', status: 'waiting' },
      ] };
    t.mock.method(mongoose, 'connect', async () => {});
    t.mock.method(mongoose, 'disconnect', async () => {});
    t.mock.method(console, 'error', () => {});
    t.mock.method(PipelineRun, 'findOne', () => ({ lean: async () => structuredClone(row) }));
    t.mock.method(PipelineRun, 'findById', () => ({ lean: async () => structuredClone(row) }));
    t.mock.method(PipelineRun, 'findOneAndUpdate', (filter, update) => ({ lean: async () => {
      assert.equal(filter.revision, row.revision);
      Object.assign(row, structuredClone(update.$set));
      for (const key of Object.keys(update.$unset || {})) delete row[key];
      return structuredClone(row);
    } }));
    t.mock.method(globalThis, 'fetch', async url => {
      assert.equal(String(url), `https://api.github.com/repos/owner/jobs/actions/runs/${remote.id}`);
      return Response.json(remote);
    });
    await import(`../scripts/pipelineGithub.js?completion=${workflowPath}`);
    assert.equal(process.exitCode, expectedExit);
    assert.equal(row.status, expectedExit ? 'running' : 'failed');
    assert.equal(row.stages[1].status, expectedExit ? 'waiting' : 'blocked');
    assert.equal(row.activeKey, expectedExit ? 'database' : undefined);
  });
}
