// Optional database-free native comparison, using predownloaded pinned assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REWRITE_MODEL, buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { prepareRewriteRuntime, startRewriteWorker, workerMemoryBytes } from '../rewriting/worker.js';
import { createRewriteClient, rewriteCandidates } from '../rewriting/runner.js';

test('optional native comparison measures one versus four slots; production starts at one', { timeout: 6600000 }, async () => {
  const directory = process.env.DESCRIPTION_SMOKE_ASSET_DIR || fileURLToPath(new URL('../.cache/small-description-model-assets/', import.meta.url));
  await fs.access(path.join(directory, REWRITE_MODEL.file));
  await fs.access(path.join(directory, REWRITE_MODEL.runtimeAssets[process.platform].file));
  const controller = new AbortController();
  const checkMemory = () => { if ((1 - os.freemem() / os.totalmem()) > .9) controller.abort(new Error('Host memory exceeds 90%')); };
  checkMemory(); controller.signal.throwIfAborted();
  const monitor = setInterval(checkMemory, 250);
  const measurements = [];
  try {
    const runtime = await prepareRewriteRuntime({ directory, signal: controller.signal });
    for (const parallelism of [1, 4]) {
      let worker;
      try {
        worker = await startRewriteWorker({ ...runtime, parallelism, threads: 4, signal: controller.signal,
          port: 18780, logFile: path.join(directory, `parallel-smoke-${parallelism}.log`) });
        const slotsResponse = await fetch(worker.endpoint + '/slots', { signal: AbortSignal.timeout(2000) });
        assert.ok(slotsResponse.ok);
        const slots = await slotsResponse.json();
        assert.equal(slots.length, parallelism);
        assert.ok(slots.every(slot => slot.n_ctx === REWRITE_MODEL.contextTokens));
        const jobs = ['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel'].map(region => {
          const row = { _id: region, title: 'Software Engineer', company: 'Example', status: 'active',
            sourceDescription: `Role overview: Build Python services for ${region} customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.`,
            descriptionRewrite: { status: 'pending', attempts: 0 } };
          row.sourceContentHash = buildRewriteInput(row).inputHash; row.descriptionRewrite.inputHash = row.sourceContentHash;
          return row;
        });
        const saved = new Set(), started = Date.now();
        const stats = await rewriteCandidates(jobs, { client: createRewriteClient(worker), concurrency: parallelism,
          signal: controller.signal, deadline: Date.now() + Math.ceil(jobs.length / parallelism) * REWRITE_MODEL.requestSeconds * 1000,
          update: async (filter, values) => {
            assert.match(values.$set.description, /At least 2 years/);
            assert.match(values.$set.description, /AWS experience is nice to have/);
            saved.add(filter._id); return { matchedCount: 1 };
          },
        });
        controller.signal.throwIfAborted();
        assert.equal(stats.published, jobs.length); assert.equal(saved.size, jobs.length); assert.equal(stats.peakConcurrency, parallelism);
        measurements.push({ parallelism, jobs: jobs.length, elapsedMs: Date.now() - started, workerMemoryBytes: await workerMemoryBytes(worker.pid), mongoWrites: 0 });
      } finally { await worker?.stop(); }
    }
    console.log(JSON.stringify({ measurements, relativeThroughput: measurements[0].elapsedMs / measurements[1].elapsedMs }));
  } finally { clearInterval(monitor); }
});
