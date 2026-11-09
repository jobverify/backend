import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteQueueQuery } from '../rewriting/runner.js';

test('a 32-runner queue covers every ObjectId suffix exactly once', () => {
  assert.doesNotThrow(() => rewriteQueueQuery(new Date(), { shard: 0, shardCount: 32 }));
  for (const shardCount of [2, 4, 8, 16, 32, 64, 128, 256]) {
    const patterns = Array.from({ length: shardCount }, (_, shard) =>
      new RegExp(rewriteQueueQuery(new Date(), { shard, shardCount }).$expr.$regexMatch.regex));
    for (let suffix = 0; suffix < 256; suffix++) {
      const id = '6adfc3e3391d35a35290d8' + suffix.toString(16).padStart(2, '0');
      assert.deepEqual(patterns.flatMap((pattern, shard) => pattern.test(id) ? [shard] : []), [suffix % shardCount]);
    }
  }
});

test('unsupported partition counts fail before reading the database', () => {
  for (const shardCount of [3, 17, 257, 0, NaN]) {
    assert.throws(() => rewriteQueueQuery(new Date(), { shard: 0, shardCount }), /shard|partition/i);
  }
});

test('the observed queue gets a full dynamic matrix rather than four fixed workers', async () => {
  const { buildRewritePlan } = await import('../rewriting/partitioning.js').catch(() => ({}));
  assert.equal(typeof buildRewritePlan, 'function');
  const plan = buildRewritePlan(27660);
  assert.equal(plan.shardCount, 32);
  assert.equal(plan.maxParallel, 4);
  assert.equal(plan.estimatedJobsPerShard, 865);
  assert.deepEqual(plan.matrix.shard, Array.from({ length: 32 }, (_, index) => index));
  assert.equal(buildRewritePlan(0).shardCount, 1);
  assert.equal(buildRewritePlan(1000).shardCount, 1);
  assert.equal(buildRewritePlan(1001).shardCount, 2);
  assert.equal(buildRewritePlan(1000000).shardCount, 256);
  assert.equal(buildRewritePlan(1000000).capacityLimited, true);
  for (const queued of [-1, 1.5, NaN, Infinity]) assert.throws(() => buildRewritePlan(queued), /queue/i);
  assert.throws(() => buildRewritePlan(10, { jobsPerShard: 0 }), /partition/i);
  assert.throws(() => buildRewritePlan(10, { maxParallel: 0 }), /parallel/i);
});

test('a configured four-shard plan keeps the complete queue in four workers', async () => {
  const { buildRewritePlan } = await import('../rewriting/partitioning.js');
  for (const queued of [0, 1000, 27660, 1000000]) {
    const plan = buildRewritePlan(queued, { shardCount: 4, maxParallel: 8 });
    assert.equal(plan.queued, queued);
    assert.equal(plan.shardCount, 4);
    assert.equal(plan.maxParallel, 4);
    assert.deepEqual(plan.matrix.shard, [0, 1, 2, 3]);
  }
  const plan = buildRewritePlan(27660, { shardCount: 4 });
  assert.equal(plan.estimatedJobsPerShard, 6915);
  assert.equal(plan.capacityLimited, true);
  for (const shardCount of [0, 3, 257, NaN]) {
    assert.throws(() => buildRewritePlan(10, { shardCount }), /shard/i);
  }
});

test('configured runner limits support 32 through 256 parallel shards', async () => {
  const { buildRewritePlan } = await import('../rewriting/partitioning.js');
  const plan = buildRewritePlan(27660, { shardCount: 32, maxParallel: 32 });
  assert.equal(plan.maxParallel, 32);
  assert.equal(plan.estimatedJobsPerShard, 865);
  assert.deepEqual(plan.matrix.shard, Array.from({ length: 32 }, (_, index) => index));
  assert.equal(buildRewritePlan(1000000, { maxParallel: 256 }).maxParallel, 256);
  assert.equal(buildRewritePlan(1000, { shardCount: 16, maxParallel: 256 }).maxParallel, 16);
  for (const maxParallel of [0, -1, 1.5, 257, NaN, Infinity]) {
    assert.throws(() => buildRewritePlan(1000, { maxParallel }), /parallel/i);
  }
});
