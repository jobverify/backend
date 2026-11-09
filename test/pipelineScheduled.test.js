import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import PipelineRun from '../src/models/PipelineRun.js';
import { startScheduledPipeline } from '../src/pipeline/scheduled.js';
import { intervalSettings } from '../src/pipeline/schedule.js';
import { createPipeline, failPipeline } from '../src/pipeline/execution.js';
import { directConfiguration } from '../src/pipeline/policy.js';

test('scheduled starts claim each interval once and retry busy slots without drift', { timeout: 300000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  await mongoose.connect(mongo.getUri());
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  const schedule = intervalSettings(11, '2026-10-31T17:00:00Z');
  const anchor = Date.parse(schedule.startAt), period = 11 * 3600000;
  const options = { configuration: directConfiguration('scraper'), target: 'github', origin: 'github', repo: 'owner/jobs', ref: 'main', initialRunId: 100 };
  assert.equal(await startScheduledPipeline(schedule, options, { now: anchor - 1 }), null);
  const first = await startScheduledPipeline(schedule, options, { now: anchor });
  assert.ok(first.scheduleSlot); assert.equal(first.stages[0].githubRunId, 100);
  // Simulate a tick whose slot lookup ran before the first claim became visible.
  const exists = PipelineRun.exists.bind(PipelineRun);
  const staleLookup = t.mock.method(PipelineRun, 'exists', (filter, ...args) =>
    filter.scheduleSlot === first.scheduleSlot ? Promise.resolve(null) : exists(filter, ...args));
  const remote = t.mock.method(globalThis, 'fetch', async () => assert.fail('A claimed interval must not query GitHub'));
  try {
    assert.equal(await startScheduledPipeline(schedule, options, { now: anchor, token: 'scheduled-test-token' }), null);
    assert.equal(remote.mock.callCount(), 0);
  } finally {
    staleLookup.mock.restore();
    remote.mock.restore();
  }
  assert.equal(await startScheduledPipeline(schedule, options, { now: anchor + 3600000 }), null);
  await failPipeline(first._id, 'failed', 'Simulate failed scheduled attempt');
  assert.equal(await startScheduledPipeline(schedule, options, { now: anchor + 2 * 3600000 }), null);

  // A local/manual run must defer the interval without consuming its slot.
  const manual = await createPipeline({ configuration: directConfiguration('scraper'), target: 'local', origin: 'admin' });
  assert.equal(await startScheduledPipeline(schedule, options, { now: anchor + period }), null);
  await failPipeline(manual._id, 'cancelled', 'Finished manual run');
  const second = await startScheduledPipeline(schedule, { ...options, initialRunId: 101 }, { now: anchor + period + 3600000 });
  assert.ok(second); assert.notEqual(second.scheduleSlot, first.scheduleSlot);
  await failPipeline(second._id, 'failed', 'Finished delayed run');

  // Concurrent ticks, even after several missed periods, create one latest run.
  const attempts = await Promise.all(Array.from({ length: 4 }, () => startScheduledPipeline(schedule, { ...options, initialRunId: 102 }, { now: anchor + 5 * period + 60000 })));
  assert.equal(attempts.filter(Boolean).length, 1);
  assert.equal(await PipelineRun.countDocuments({ scheduleSlot: { $exists: true } }), 3);
  await failPipeline(attempts.find(Boolean)._id, 'failed', 'Cleanup');
  const direct = await createPipeline(options);
  assert.equal(direct.scheduleSlot, undefined);
});
