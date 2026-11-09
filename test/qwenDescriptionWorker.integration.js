/** Optional native, database-free check: node --test test/qwenDescriptionWorker.integration.js */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REWRITE_MODEL, buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { prepareRewriteRuntime, startRewriteWorker, sha256File, workerMemoryBytes } from '../rewriting/worker.js';
import { createRewriteClient, rewriteCandidates } from '../rewriting/runner.js';

test('the pinned production CPU worker organizes employer descriptions through the production client', { timeout: 720000 }, async () => {
  const directory = process.env.DESCRIPTION_SMOKE_ASSET_DIR || fileURLToPath(new URL('../.cache/small-description-model-assets/', import.meta.url));
  const asset = REWRITE_MODEL.runtimeAssets[process.platform];
  assert.ok(asset, 'A pinned runtime must exist for this platform');
  // Require predownloaded assets: this smoke check never silently downloads a model.
  assert.equal((await fs.stat(path.join(directory, REWRITE_MODEL.file))).size, REWRITE_MODEL.bytes);
  assert.equal(await sha256File(path.join(directory, REWRITE_MODEL.file)), REWRITE_MODEL.sha256);
  assert.equal(await sha256File(path.join(directory, asset.file)), asset.sha256);
  const controller = new AbortController();
  let peakHostMemory = 0, worker;
  const checkMemory = () => {
    const used = (1 - os.freemem() / os.totalmem()) * 100;
    peakHostMemory = Math.max(peakHostMemory, used);
    if (used > 90) controller.abort(new Error('Host physical memory exceeded 90%; native description check stopped.'));
  };
  checkMemory();
  controller.signal.throwIfAborted();
  const monitor = setInterval(checkMemory, 1000);
  try {
    worker = await startRewriteWorker({ ...await prepareRewriteRuntime({ directory, signal: controller.signal }),
      signal: controller.signal, port: 18779, logFile: path.join(directory, 'description-production-smoke.log') });
    const source = 'Role overview: Build Python services for customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.';
    const job = { _id: 'native-qwen', title: 'Software Engineer', company: 'Example', sourceDescription: source, status: 'active', descriptionRewrite: { status: 'pending', attempts: 0 } };
    const input = buildRewriteInput(job);
    job.sourceContentHash = input.inputHash;
    job.descriptionRewrite.inputHash = input.inputHash;
    let saved;
    const started = Date.now();
    const stats = await rewriteCandidates([job], { client: createRewriteClient(worker), deadline: Date.now() + REWRITE_MODEL.requestSeconds * 1000,
      signal: controller.signal, update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; } });
    controller.signal.throwIfAborted();
    assert.equal(stats.published, 1);
    assert.match(saved.$set.description, /## Required qualifications/);
    assert.match(saved.$set.description, /At least 2 years/);
    assert.match(saved.$set.description, /## Preferred/);
    assert.match(saved.$set.description, /AWS experience is nice to have/);
    assert.equal(saved.$set.sourceDescription, undefined);
    assert.equal(saved.$set['descriptionRewrite.modelRevision'], REWRITE_MODEL.revision);
    console.log(JSON.stringify({ modelId: REWRITE_MODEL.modelId, durationMs: Date.now() - started,
      workerMemoryBytes: await workerMemoryBytes(worker.pid), peakHostMemoryPercent: Math.round(peakHostMemory * 10) / 10, mongoWrites: 0 }));
  } finally {
    clearInterval(monitor);
    await worker?.stop();
  }
});
