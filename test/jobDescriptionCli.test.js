import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
const exec = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/rewriteJobDescriptions.js', import.meta.url));

test('CLI preview only reads the eligible queue and never backfills or generates', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'description-preview-'));
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); await fs.rm(cwd, { recursive: true, force: true }); });
  await mongoose.connect(mongo.getUri());
  await Job.insertMany(['pending', 'published', 'baseline', 'skipped', 'failed'].map((status, index) => ({
    title: 'Software Engineer', company: 'Example', fingerprint: 'cli-' + index, description: 'Employer source', sourceContentHash: 'source-' + index,
    descriptionRewrite: { status, attempts: status === 'failed' ? 3 : 0, nextAttemptAt: new Date(0), queuedAt: new Date() },
  })));
  const before = await Job.find().sort({ fingerprint: 1 }).lean();
  const { stdout } = await exec(process.execPath, [script], { cwd, windowsHide: true, env: { ...process.env, MONGO_URI: mongo.getUri(), JOB_DESCRIPTION_REWRITE_MODE: 'publish' } });
  const summary = JSON.parse(stdout.trim().split('\n').at(-1));
  assert.equal(summary.queued, 1);
  assert.equal(summary.reason, 'read_only_preview');
  assert.deepEqual(await Job.find().sort({ fingerprint: 1 }).lean(), before);
  assert.deepEqual(await fs.readdir(path.join(cwd, '.cache')), ['scraper-actions']);
  const shards = await Promise.all([0, 1, 2, 3].map(async shard => {
    const result = await exec(process.execPath, [script], { cwd, windowsHide: true, env: {
      ...process.env, MONGO_URI: mongo.getUri(), JOB_DESCRIPTION_REWRITE_MODE: 'publish',
      JOB_DESCRIPTION_REWRITE_SHARD: String(shard), JOB_DESCRIPTION_REWRITE_SHARD_COUNT: '4',
    } });
    const part = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(part.shard, shard);
    assert.equal(part.shardCount, 4);
    const saved = JSON.parse(await fs.readFile(path.join(cwd, `.cache/scraper-actions/description-summary-${shard}.json`), 'utf8'));
    assert.equal(saved.queued, part.queued);
    return part;
  }));
  assert.equal(shards.reduce((sum, part) => sum + part.queued, 0), 1);
  assert.deepEqual(await Job.find().sort({ fingerprint: 1 }).lean(), before);
});

test('disabled or exhausted CLI runs do not connect to MongoDB or start a model', async t => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'description-disabled-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  for (const [mode, budget, reason] of [['off', '1200', 'disabled'], ['publish', '0', 'workflow_budget_exhausted']]) {
    const result = await exec(process.execPath, [script, '--apply'], { cwd, windowsHide: true,
      env: { ...process.env, MONGO_URI: '', JOB_DESCRIPTION_REWRITE_MODE: mode, JOB_DESCRIPTION_REWRITE_BUDGET_SECONDS: budget } }).then(result => ({ ...result, code: 0 }), error => error);
    assert.equal(result.code, mode === 'off' ? 1 : 0);
    const summary = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(summary.reason, reason);
    assert.equal(summary.outcome, mode === 'off' ? 'failed' : 'completed');
    assert.equal(summary.processingComplete, false);
    assert.equal(summary.handoffReady, mode !== 'off');
  }
});

test('production GPU settings require an explicit compatible binary and checksum before database access', async t => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'rewrite-gpu-config-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const result = await exec(process.execPath, [script, '--apply'], { cwd, windowsHide: true,
    env: { ...process.env, MONGO_URI: '', JOB_DESCRIPTION_REWRITE_MODE: 'off', JOB_DESCRIPTION_REWRITE_GPU_LAYERS: 'all',
      JOB_DESCRIPTION_REWRITE_BINARY: '', JOB_DESCRIPTION_REWRITE_BINARY_SHA256: '' } }).catch(error => error);
  assert.match(result.stderr, /compatible binary.*checksum/i);
  assert.equal(result.code, 1);
});

test('a budget-stopped shard saves its own summary and rejection diagnostics', async t => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'description-shard-stop-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const { stdout } = await exec(process.execPath, [script, '--apply'], { cwd, windowsHide: true, env: {
    ...process.env, MONGO_URI: '', JOB_DESCRIPTION_REWRITE_MODE: 'publish', JOB_DESCRIPTION_REWRITE_BUDGET_SECONDS: '0',
    JOB_DESCRIPTION_REWRITE_SHARD: '2', JOB_DESCRIPTION_REWRITE_SHARD_COUNT: '4',
  } });
  const summary = JSON.parse(stdout.trim().split('\n').at(-1));
  assert.equal(summary.shard, 2);
  assert.equal(summary.shardCount, 4);
  assert.equal(summary.rejectionDiagnostics.file, 'description-rejections-2.json');
  assert.deepEqual((await fs.readdir(path.join(cwd, '.cache/scraper-actions'))).sort(),
    ['description-rejections-2.json', 'description-summary-2.json']);
});

test('a one-partition workflow keeps the same suffixed filenames as larger matrices', async t => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'description-one-shard-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const { stdout } = await exec(process.execPath, [script, '--apply'], { cwd, windowsHide: true, env: {
    ...process.env, MONGO_URI: '', JOB_DESCRIPTION_REWRITE_MODE: 'publish', JOB_DESCRIPTION_REWRITE_BUDGET_SECONDS: '0',
    JOB_DESCRIPTION_REWRITE_SHARD: '0', JOB_DESCRIPTION_REWRITE_SHARD_COUNT: '1',
  } });
  const summary = JSON.parse(stdout.trim().split('\n').at(-1));
  assert.equal(summary.rejectionDiagnostics.file, 'description-rejections-0.json');
  assert.deepEqual((await fs.readdir(path.join(cwd, '.cache/scraper-actions'))).sort(),
    ['description-rejections-0.json', 'description-summary-0.json']);
});
