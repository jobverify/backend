import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { rewriteCandidates } from '../rewriting/runner.js';
import { rewriteWorkerConfiguration } from '../rewriting/worker.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';

const source = 'Role overview: Build Python services for customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.';
const valid = { sections: [['overview', 'Build Python services for customer applications.'], ['responsibilities', 'Design reliable APIs and maintain Python services.'], ['required_qualifications', 'At least 2 years of software development experience is required.'], ['preferred', 'AWS experience is nice to have.']].map(([key, text]) => ({ key, items: [{ text, evidence: text, style: 'paragraph' }] })) };
const job = id => {
  const row = { _id: id, title: 'Software Engineer', company: 'Example', sourceDescription: source, status: 'active', descriptionRewrite: { status: 'pending', attempts: 0 } };
  row.sourceContentHash = buildRewriteInput(row).inputHash;
  row.descriptionRewrite.inputHash = row.sourceContentHash;
  return row;
};

test('one model shares the available CPU threads and preserves context for four request slots', () => {
  assert.deepEqual(rewriteWorkerConfiguration({ threads: 4, parallelism: 4, availableCpus: 4 }), { threads: 4, parallelism: 4, contextTokens: 32768 });
  assert.deepEqual(rewriteWorkerConfiguration({ threads: 8, parallelism: 8, availableCpus: 2 }), { threads: 2, parallelism: 2, contextTokens: 16384 });
  assert.equal(rewriteWorkerConfiguration({ availableCpus: 4 }).parallelism, 1);
  for (const value of [-1, 0, 1.5, 'bad']) assert.throws(() => rewriteWorkerConfiguration({ parallelism: value }), /parallel|thread/i);
});

test('CPU workers use requested resources across all available cores', () => {
  assert.deepEqual(rewriteWorkerConfiguration({ threads: 8, parallelism: 8, availableCpus: 8 }),
    { threads: 8, parallelism: 8, contextTokens: 65536 });
  assert.deepEqual(rewriteWorkerConfiguration({ threads: 64, parallelism: 32, availableCpus: 64 }),
    { threads: 64, parallelism: 32, contextTokens: 262144 });
  assert.deepEqual(rewriteWorkerConfiguration({ threads: 16, parallelism: 32, availableCpus: 8 }),
    { threads: 8, parallelism: 8, contextTokens: 65536 });
  assert.deepEqual(rewriteWorkerConfiguration({ availableCpus: 64 }),
    { threads: 4, parallelism: 1, contextTokens: 8192 });
});

test('explicit GPU offload permits 32 slots while CPU threads remain bounded', () => {
  for (const gpuLayers of [1, '8', 'all', 'auto']) {
    assert.deepEqual(rewriteWorkerConfiguration({ threads: 8, parallelism: 32, availableCpus: 2, gpuLayers }),
      { threads: 2, parallelism: 32, contextTokens: 262144 });
  }
  for (const gpuLayers of [0, '0']) {
    assert.deepEqual(rewriteWorkerConfiguration({ threads: 8, parallelism: 32, availableCpus: 2, gpuLayers }),
      { threads: 2, parallelism: 2, contextTokens: 16384 });
  }
});

test('worker resource validation rejects unsupported slots and malformed GPU settings', () => {
  for (const parallelism of [33, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => rewriteWorkerConfiguration({ parallelism, availableCpus: 2 }), /parallel|thread/i);
    assert.throws(() => rewriteWorkerConfiguration({ parallelism, availableCpus: 2, gpuLayers: 'all' }), /parallel|thread/i);
  }
  for (const field of ['threads', 'availableCpus']) {
    for (const value of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => rewriteWorkerConfiguration({ [field]: value }), /parallel|thread/i);
    }
  }
  for (const gpuLayers of [true, false, null, -1, 1.5, 'invalid']) {
    assert.throws(() => rewriteWorkerConfiguration({ gpuLayers }), /GPU layers/);
  }
});

test('four rewrites overlap while a single iterator reads each job once', async () => {
  let active = 0, peak = 0, reading = false;
  const rows = Array.from({ length: 12 }, (_, i) => job(`job-${i}`));
  const iterator = {
    index: 0, [Symbol.asyncIterator]() { return this; },
    async next() {
      assert.equal(reading, false); reading = true; await delay(1); reading = false;
      return this.index < rows.length ? { value: rows[this.index++], done: false } : { done: true };
    },
  };
  const saved = [];
  const stats = await rewriteCandidates(iterator, { concurrency: 4, deadline: Date.now() + 10000,
    client: { generate: async () => { active++; peak = Math.max(peak, active); await delay(20); active--; return { value: valid, finishReason: 'stop' }; } },
    update: async (filter, values) => { saved.push({ filter, values }); return { matchedCount: 1 }; },
  });
  assert.equal(peak, 4); assert.equal(stats.published, rows.length); assert.equal(stats.peakConcurrency, 4);
  assert.equal(new Set(saved.map(row => row.filter._id)).size, rows.length);
  assert.ok(saved.every(row => row.filter.sourceContentHash === rows[0].sourceContentHash && row.values.$set.sourceDescription === undefined));
});

test('32 rewrite slots overlap without reading or publishing a job twice', async () => {
  let active = 0, peak = 0;
  const rows = Array.from({ length: 40 }, (_, i) => job(`larger-${i}`));
  const saved = [];
  const stats = await rewriteCandidates(rows, { concurrency: 32, deadline: Date.now() + 10000,
    client: { generate: async () => { active++; peak = Math.max(peak, active); await delay(20); active--; return { value: valid, finishReason: 'stop' }; } },
    update: async filter => { saved.push(filter._id); return { matchedCount: 1 }; },
  });
  assert.equal(peak, 32);
  assert.equal(stats.published, 40);
  assert.equal(stats.peakConcurrency, 32);
  assert.equal(saved.length, 40);
  assert.equal(new Set(saved).size, 40);
});

test('cancellation leaves all in-flight jobs pending', async () => {
  const controller = new AbortController(); let started = 0, writes = 0;
  const stats = await rewriteCandidates(Array.from({ length: 10 }, (_, i) => job(String(i))), { concurrency: 4,
    deadline: Date.now() + 10000, signal: controller.signal,
    client: { generate: async () => { started++; await delay(10); controller.abort(); return { value: valid, finishReason: 'stop' }; } },
    update: async () => { writes++; return { matchedCount: 1 }; },
  });
  assert.equal(started, 4); assert.equal(writes, 0); assert.equal(stats.interrupted, true);
});

test('a fatal update failure settles scheduled work before returning', async () => {
  let active = 0, started = 0;
  await assert.rejects(rewriteCandidates(Array.from({ length: 10 }, (_, i) => job(String(i))), { concurrency: 4,
    deadline: Date.now() + 10000,
    client: { generate: async () => { active++; started++; await delay(10); active--; return { value: valid, finishReason: 'stop' }; } },
    update: async () => { throw new Error('Database write failed'); },
  }), /Database write failed/);
  assert.equal(active, 0); assert.equal(started, 4);
});

test('invalid concurrency is rejected before reading the queue', async () => {
  for (const concurrency of [0, -1, 1.5, 33, NaN]) await assert.rejects(rewriteCandidates([], { concurrency }), /concurrency/i);
});

test('a queue read failure drains active work before cleanup', async () => {
  let active = 0, saved = 0;
  const jobs = { async *[Symbol.asyncIterator]() {
    for (let i = 0; i < 3; i++) yield job(String(i));
    throw new Error('Cursor read failed');
  } };
  await assert.rejects(rewriteCandidates(jobs, { concurrency: 4, deadline: Date.now() + 10000,
    client: { generate: async () => { active++; await delay(10); active--; return { value: valid, finishReason: 'stop' }; } },
    update: async () => { saved++; return { matchedCount: 1 }; },
  }), /Cursor read failed/);
  assert.equal(active, 0); assert.equal(saved, 3);
});
