import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';

test('classification CLI exits successfully for item errors and budget stops, and fails execution errors', { timeout: 60000 }, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'classification-cli-'));
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); await fs.rm(directory, { recursive: true, force: true }); });
  await mongoose.connect(mongo.getUri());
  const workerSource = `export const startGliclassWorker = async () => ({
    stop: async () => {},
    classify: async input => {
      if (process.env.TEST_CLASSIFICATION_MODE === 'fatal') throw Object.assign(new Error('controlled database failure'), { name: 'MongoServerError' });
      if (input.title === 'Engineer 0') throw new Error('prediction unavailable for this description');
      return { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
        scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } };
    }
  });`;
  const batchSource = 'export const refreshJobBatchEligibility = async () => ({ failed: 1, pending: 2, budgetExhausted: true });';
  const hook = path.join(directory, 'model-fixtures.mjs');
  await fs.writeFile(hook, `import { registerHooks } from 'node:module';
    const fixtures = new Map(${JSON.stringify([
      ['./gliclassWorker.js', workerSource], ['./lib/batchEligibilityPhase.js', batchSource],
    ])});
    registerHooks({ resolve(specifier, context, next) {
      if (context.parentURL?.endsWith('/scripts/classifySavedJobs.js') && fixtures.has(specifier))
        return { url: 'data:text/javascript,' + encodeURIComponent(fixtures.get(specifier)), shortCircuit: true };
      return next(specifier, context);
    } });`);
  const script = fileURLToPath(new URL('../scripts/classifySavedJobs.js', import.meta.url));
  for (const mode of ['soft', 'budget', 'fatal']) {
    await Job.deleteMany({});
    await Job.insertMany([0, 1].map(index => ({ title: `Engineer ${index}`, company: 'CLI Fixture',
      fingerprint: `cli-${index}`, status: 'active',
      sourceDescription: 'Minimum 3 years of professional experience required. Build production services.' })));
    const output = path.join(directory, `${mode}.json`);
    const run = () => promisify(execFile)(process.execPath, ['--import', pathToFileURL(hook).href, script], {
      cwd: directory, windowsHide: true, timeout: 20000,
      env: { ...process.env, NODE_ENV: 'test', MONGO_URI: mongo.getUri(), TEST_CLASSIFICATION_MODE: mode,
        CLASSIFICATION_SHARD: '0', CLASSIFICATION_SHARD_COUNT: '1', CLASSIFICATION_CONCURRENCY: '1',
        CLASSIFICATION_BUDGET_SECONDS: mode === 'budget' ? '0.000001' : '30',
        POST_SCRAPE_CLASSIFICATION_MODE: 'policy', CLASSIFICATION_SUMMARY_FILE: output,
        CLASSIFICATION_DIAGNOSTICS_FILE: path.join(directory, `${mode}.ndjson`) },
    });
    if (mode === 'fatal') {
      await assert.rejects(run, error => error.code === 1 && /controlled database failure/.test(error.stderr));
      continue;
    }
    await run();
    const summary = JSON.parse(await fs.readFile(output, 'utf8'));
    assert.equal(summary.outcome, 'completed');
    assert.equal(summary.handoffReady, true);
    assert.equal(summary.processingComplete, false);
    assert.equal(summary.batchEligibility.pending, 2);
    if (mode === 'soft') { assert.equal(summary.failed, 1); assert.equal(summary.completed, 1); }
    else assert.equal(summary.budgetExhausted, true);
  }
});
