import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfiguration } from '../src/pipeline/policy.js';
import { resolveConfiguredParallelScraperConcurrency } from '../scraper-support/utils/parallelConcurrency.js';
import { isTelegramDeliveryEnabled } from '../src/services/telegramProvider.js';
import { buildRewritePlan } from '../rewriting/partitioning.js';

test('missing scraper configuration uses five workers and preserves explicit overrides', t => {
  const original = process.env.SCRAPER_CONCURRENCY;
  t.after(() => { if (original === undefined) delete process.env.SCRAPER_CONCURRENCY; else process.env.SCRAPER_CONCURRENCY = original; });
  for (const value of [undefined, '', 'invalid']) {
    if (value === undefined) delete process.env.SCRAPER_CONCURRENCY; else process.env.SCRAPER_CONCURRENCY = value;
    assert.equal(defaultConfiguration().scraperConcurrency, 5);
    assert.equal(resolveConfiguredParallelScraperConcurrency(), 5);
  }
  process.env.SCRAPER_CONCURRENCY = '7';
  assert.equal(defaultConfiguration().scraperConcurrency, 7);
  assert.equal(resolveConfiguredParallelScraperConcurrency(), 7);
});

test('Telegram is enabled when unset or empty and can still be explicitly disabled', t => {
  const original = process.env.TELEGRAM_ENABLED;
  t.after(() => { if (original === undefined) delete process.env.TELEGRAM_ENABLED; else process.env.TELEGRAM_ENABLED = original; });
  delete process.env.TELEGRAM_ENABLED;
  assert.equal(isTelegramDeliveryEnabled(), true);
  process.env.TELEGRAM_ENABLED = '';
  assert.equal(isTelegramDeliveryEnabled(), true);
  for (const value of ['false', '0', 'off']) {
    process.env.TELEGRAM_ENABLED = value;
    assert.equal(isTelegramDeliveryEnabled(), false);
  }
});

test('automatic jobs per shard changes with queue size and runner capacity without a fixed job target', () => {
  for (const jobsPerShard of [undefined, 'auto', 'automatic']) {
    const plan = buildRewritePlan(27826, { jobsPerShard });
    assert.equal(plan.shardCount, 128);
    assert.equal(plan.jobsPerShard, 218);
    assert.equal(plan.estimatedJobsPerShard, 218);
    assert.equal(plan.plannedWaves, 2);
    assert.equal(plan.capacityLimited, false);
  }
  assert.equal(buildRewritePlan(12800).jobsPerShard, 100);
  const smallerPool = buildRewritePlan(12800, { maxParallel: 8 });
  assert.equal(smallerPool.shardCount, 16);
  assert.equal(smallerPool.jobsPerShard, 800);
  assert.equal(buildRewritePlan(12800, { shardCount: 4 }).jobsPerShard, 3200);
  assert.equal(buildRewritePlan(0).shardCount, 1);
  assert.equal(buildRewritePlan(1).shardCount, 1);
  assert.equal(buildRewritePlan(1000000, { maxParallel: 256 }).shardCount, 256);
  const fixed = buildRewritePlan(27826, { jobsPerShard: 350, shardCount: 32 });
  assert.equal(fixed.jobsPerShard, 350);
  assert.equal(fixed.capacityLimited, true);
  assert.throws(() => buildRewritePlan(10, { jobsPerShard: 'invalid' }), /partition/i);
});

test('automatic sizing does not allocate more shards than jobs for tiny queues', () => {
  assert.equal(buildRewritePlan(3).shardCount, 2);
  assert.equal(buildRewritePlan(100).shardCount, 64);
  assert.equal(buildRewritePlan(0).shardCount, 1);
});
