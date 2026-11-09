import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import ScraperSchedule from '../src/models/ScraperSchedule.js';
import PipelineRun from '../src/models/PipelineRun.js';
import { getScraperSchedule, updateScraperSchedule, nextScheduleRun } from '../src/pipeline/schedule.js';
import { tickScraperSchedule, scraperSchedulerEnabled } from '../src/pipeline/scheduler.js';
import { createPipeline, failPipeline, claimStage } from '../src/pipeline/execution.js';
import { reconcileGithub } from '../src/pipeline/github.js';
import { directConfiguration } from '../src/pipeline/policy.js';

test('scheduler is opt-in outside production and can be disabled in production', () => {
  assert.equal(scraperSchedulerEnabled({}), false);
  assert.equal(scraperSchedulerEnabled({ NODE_ENV: 'production' }), true);
  assert.equal(scraperSchedulerEnabled({ NODE_ENV: 'production', SCRAPER_SCHEDULER_ENABLED: 'false' }), false);
  assert.equal(scraperSchedulerEnabled({ SCRAPER_SCHEDULER_ENABLED: 'true' }), true);
});

test('IST next run handles exact times and day boundaries', () => {
  assert.equal(nextScheduleRun({ mode: 'daily', time: '08:30' }, Date.parse('2026-11-01T02:59:00Z')), '2026-11-01T03:00:00.000Z');
  assert.equal(nextScheduleRun({ mode: 'daily', time: '08:30' }, Date.parse('2026-11-01T03:00:00Z')), '2026-11-02T03:00:00.000Z');
  assert.equal(nextScheduleRun({ mode: 'daily', time: '00:15' }, Date.parse('2026-10-31T18:46:00Z')), '2026-11-01T18:45:00.000Z');
});

test('database schedule saves, dispatches once, retries busy runs and survives restart', { timeout: 300000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  await mongoose.connect(mongo.getUri());
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  const due = Date.parse('2026-11-01T03:00:00Z');
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network call'); });
  const initial = await getScraperSchedule({ now: due - 60000 });
  assert.equal(initial.time, '08:30'); assert.equal(initial.revision, 0);
  const saved = await updateScraperSchedule({ time: '08:31', revision: 0 }, { now: due - 60000 });
  assert.equal(saved.revision, 1); assert.equal((await getScraperSchedule()).time, '08:31');
  await assert.rejects(updateScraperSchedule({ time: '09:00', revision: 0 }), { status: 409 });
  for (const body of [{ time: '24:00', revision: 1 }, { time: '08:30' }, { mode: 'weekly', revision: 1 }]) await assert.rejects(updateScraperSchedule(body), { status: 400 });
  const edits = await Promise.allSettled(['09:00', '10:00'].map(time => updateScraperSchedule({ time, revision: 1 }, { now: due - 60000 })));
  assert.equal(edits.filter(r => r.status === 'fulfilled').length, 1);
  await updateScraperSchedule({ time: '08:30', revision: 2 }, { now: due - 60000 });
  const calls = [];
  const request = async (_repo, endpoint, options) => {
    calls.push({ endpoint, options });
    if (endpoint === '') return { default_branch: 'main' };
    if (endpoint.startsWith('/commits/')) return { sha: 'a'.repeat(40) };
    return { state: 'active' };
  };
  let dispatches = 0;
  const dispatch = async () => { dispatches++; };
  const tick = now => tickScraperSchedule({ now, repo: 'owner/jobs', token: 'test', request, dispatch });
  assert.equal(await tick(due - 1), null); assert.equal(calls.length, 0);
  const attempts = await Promise.all(Array.from({ length: 4 }, () => tick(due)));
  const first = attempts.find(Boolean);
  assert.ok(first); assert.equal(dispatches, 1);
  assert.equal((await PipelineRun.findById(first._id).lean()).stages[0].status, 'queued');
  await failPipeline(first._id, 'completed', 'Done');
  assert.equal(await tick(due + 60000), null); assert.equal(dispatches, 1);
  assert.equal((await getScraperSchedule()).nextRunAt, '2026-11-02T03:00:00.000Z');
  const manual = await createPipeline({ configuration: directConfiguration('scraper'), target: 'local', origin: 'admin' });
  assert.equal(await tick(due + 86400000), null);
  assert.equal((await getScraperSchedule()).nextRunAt, '2026-11-02T03:00:00.000Z');
  await failPipeline(manual._id, 'completed', 'Done');
  const delayed = await tick(due + 86400000 + 30000);
  assert.ok(delayed); assert.equal(dispatches, 2);
  await failPipeline(delayed._id, 'completed', 'Done');
  const resumed = await tick(due + 5 * 86400000 + 60000);
  assert.ok(resumed); assert.equal(dispatches, 3);
  await failPipeline(resumed._id, 'completed', 'Done');
  // Crash after pipeline insertion but before next-run checkpoint must not duplicate.
  await ScraperSchedule.updateOne({ _id: 'global' }, { $set: { nextRunAt: new Date(due + 5 * 86400000), leaseUntil: new Date(0) } });
  assert.equal(await tick(due + 5 * 86400000 + 120000), null);
  assert.equal(dispatches, 3);
  assert.equal((await getScraperSchedule()).nextRunAt, '2026-11-07T03:00:00.000Z');
  const current = await getScraperSchedule();
  await updateScraperSchedule({ mode: 'interval', hours: 11, startAt: '2026-11-07T04:00:00Z', revision: current.revision }, { now: due });
  const intervalRun = await tick(Date.parse('2026-11-07T04:00:00Z'));
  assert.ok(intervalRun); assert.equal(dispatches, 4);
  await failPipeline(intervalRun._id, 'completed', 'Done');
  assert.equal((await getScraperSchedule()).nextRunAt, '2026-11-07T15:00:00.000Z');
  await assert.rejects(tickScraperSchedule({ now: Date.parse('2026-11-07T15:00:00Z'), repo: 'owner/jobs', token: 'test', request: async () => { throw new Error('offline'); }, dispatch }));
  assert.equal((await getScraperSchedule()).nextRunAt, '2026-11-07T15:00:00.000Z');
  assert.match((await getScraperSchedule()).lastError, /offline/);
  const retried = await tick(Date.parse('2026-11-07T15:00:30Z'));
  assert.ok(retried); assert.equal(dispatches, 5);
  assert.equal((await getScraperSchedule()).lastError, null);
  // Recovery redelivers a persisted queue entry with the original identity.
  await PipelineRun.updateOne({ _id: retried._id }, { $set: { 'stages.0.queuedAt': new Date(Date.now() - 2 * 86400000) } });
  let recoveredDispatch;
  t.mock.method(globalThis, 'fetch', async (_url, options = {}) => {
    if (options.method === 'POST') { recoveredDispatch = JSON.parse(options.body); return new Response(null, { status: 204 }); }
    return Response.json({ workflow_runs: [] });
  });
  const queued = await PipelineRun.findById(retried._id).lean();
  await reconcileGithub(queued, { token: 'test' });
  assert.equal(recoveredDispatch.inputs.dispatch_token, queued.stages[0].dispatchToken);
  await claimStage(queued._id, 'scraper', { runId: 123, token: queued.stages[0].dispatchToken });
  await assert.rejects(claimStage(queued._id, 'scraper', { runId: 124, token: queued.stages[0].dispatchToken }), { status: 409 });
  await failPipeline(queued._id, 'completed', 'Done');

  // A worker paused beyond its lease must not launch settings changed by an admin.
  const staleNow = Date.parse('2026-11-08T02:00:00Z');
  const beforeStale = await getScraperSchedule();
  let changed = false;
  const staleRequest = async (...args) => {
    if (!changed) {
      changed = true;
      await assert.rejects(updateScraperSchedule({ time: '12:00', revision: beforeStale.revision }, { now: staleNow }), { status: 409 });
      await ScraperSchedule.updateOne({ _id: 'global' }, { $set: { leaseUntil: new Date(0) } });
      await updateScraperSchedule({ time: '12:00', revision: beforeStale.revision }, { now: staleNow });
    }
    return request(...args);
  };
  assert.equal(await tickScraperSchedule({ now: staleNow, repo: 'owner/jobs', token: 'test', request: staleRequest, dispatch }), null);
  assert.equal(dispatches, 5);
  assert.equal((await getScraperSchedule()).time, '12:00');
});
