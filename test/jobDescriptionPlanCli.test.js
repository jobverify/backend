import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/planDescriptionRewrites.js', import.meta.url));

test('queue planning honors a configured 32-shard plan and runner limit with one retry cutoff', async t => {
  assert.equal(await fs.access(script).then(() => true, () => false), true, 'planning CLI must exist');
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'rewrite-plan-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const summary = path.join(cwd, 'preview.json'), output = path.join(cwd, 'outputs');
  await fs.writeFile(summary, JSON.stringify({ mode: 'preview', queued: 1000,
    queueAsOf: '2026-10-30T10:00:00.000Z', startedAt: '2026-10-30T10:00:01.000Z' }));
  const result = await exec(process.execPath, [script, summary], { cwd, windowsHide: true, env: {
    ...process.env, GITHUB_OUTPUT: output, JOB_DESCRIPTION_REWRITE_JOBS_PER_SHARD: '1000',
    JOB_DESCRIPTION_REWRITE_SHARD_COUNT: '32', JOB_DESCRIPTION_REWRITE_MAX_PARALLEL: '24',
  } });
  const plan = JSON.parse(result.stdout.trim());
  assert.equal(plan.shardCount, 32);
  assert.equal(plan.maxParallel, 24);
  assert.equal(plan.queued, 1000);
  assert.equal(plan.estimatedJobsPerShard, 32);
  assert.equal(plan.queueAsOf, '2026-10-30T10:00:00.000Z');
  const fields = Object.fromEntries((await fs.readFile(output, 'utf8')).trim().split('\n').map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  }));
  assert.equal(fields.shard_count, '32');
  assert.equal(fields.max_parallel, '24');
  assert.equal(fields.queue_as_of, plan.queueAsOf);
  assert.deepEqual(JSON.parse(fields.matrix), { shard: Array.from({ length: 32 }, (_, index) => index) });
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(cwd, '.cache/scraper-actions/description-plan.json'))), plan);
});

test('queue planning defaults to 32 parallel runners with automatic shard sizing', async t => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'rewrite-plan-32-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const summary = path.join(cwd, 'preview.json'), output = path.join(cwd, 'outputs');
  await fs.writeFile(summary, JSON.stringify({ queued: 27660, queueAsOf: '2026-11-07T10:00:00.000Z' }));
  const env = {
    ...process.env, GITHUB_OUTPUT: output, JOB_DESCRIPTION_REWRITE_JOBS_PER_SHARD: '1000',
  };
  delete env.JOB_DESCRIPTION_REWRITE_SHARD_COUNT;
  delete env.JOB_DESCRIPTION_REWRITE_MAX_PARALLEL;
  const { stdout } = await exec(process.execPath, [script, summary], { cwd, windowsHide: true, env });
  const plan = JSON.parse(stdout.trim());
  assert.equal(plan.shardCount, 32);
  assert.equal(plan.maxParallel, 32);
  assert.equal(plan.estimatedJobsPerShard, 865);
  const fields = Object.fromEntries((await fs.readFile(output, 'utf8')).trim().split('\n').map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  }));
  assert.equal(fields.shard_count, '32');
  assert.equal(fields.max_parallel, '32');
  assert.deepEqual(JSON.parse(fields.matrix).shard, Array.from({ length: 32 }, (_, index) => index));
});
