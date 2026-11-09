import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import User from '../src/models/User.js';
import Subscription from '../src/models/Subscription.js';
import JobAlertDelivery from '../src/models/JobAlertDelivery.js';
import JobAlertOutbox from '../src/models/JobAlertOutbox.js';
import TelegramChannelDelivery from '../src/models/TelegramChannelDelivery.js';
import TelegramChannelSchedule from '../src/models/TelegramChannelSchedule.js';
import TelegramBroadcastSettings from '../src/models/TelegramBroadcastSettings.js';
import { DEFAULT_BROADCAST_TEMPLATE } from '../src/services/telegramBroadcastTemplate.js';
import { claimJobAlertEvent, persistJobChangesWithAlertOutbox, processClaimedJobAlertEvent, recoverJobAlertOutbox } from '../src/services/jobAlertOutboxService.js';
import { updateAlertSchedule } from '../src/services/alertScheduleService.js';
import { saveToDB } from '../scraper-support/utils/saveToDB.js';

test('job persistence retains the alert obligation without a running worker', { timeout: 90_000 }, async t => {
  const mongo = new MongoMemoryReplSet({
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) },
    // Cached mongod startup can exceed its 10s default on busy Windows runners.
    instanceOpts: [{ launchTimeout: 30_000 }],
    replSet: { count: 1, spawn: { signal: t.signal } },
  });
  let startup;
  t.after(async () => {
    try { await mongoose.disconnect(); }
    finally {
      // Retain server handles until a cancelled or delayed start has settled.
      try { await mongo.stop({ doCleanup: false }); }
      finally {
        await startup?.catch(() => {});
        await mongo.stop();
      }
    }
  });
  t.signal.throwIfAborted();
  startup = mongo.start();
  await startup;
  t.signal.throwIfAborted();
  await mongoose.connect(mongo.getUri(), { monitorCommands: true });
  t.signal.throwIfAborted();
  await Promise.all([Job.init(), User.init(), Subscription.init(), JobAlertDelivery.init(), JobAlertOutbox.init(),
    TelegramChannelDelivery.init(), TelegramChannelSchedule.init(), TelegramBroadcastSettings.init()]);
  t.signal.throwIfAborted();
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('External sends are forbidden in local outbox tests.'); });
  const source = [{ title: 'Software Engineer', company: 'Example', location: 'Bengaluru, India',
    city: 'Bengaluru', link: 'https://example.com/jobs/outbox-engineer',
    description: 'Build software with JavaScript and Node.js for the engineering team.' }];
  const saved = await saveToDB(source, 'local-outbox-fixture', { replaceExisting: false, refreshDatasetSummary: false });
  assert.equal(saved.inserted, 1);
  const job = await Job.findOne({ source: 'local-outbox-fixture' }).lean();
  assert.ok(job);
  assert.equal(await mongoose.connection.collection('jobalertoutboxes').countDocuments({ job: job._id, status: 'pending' }), 1,
    'Publishing a job must persist pending notification work in the same commit, before any worker runs.');

  const reset = async () => {
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: {} });
    await mongoose.connection.db.command({ collMod: 'telegramchanneldeliveries', validator: {} });
    await Promise.all([Job.deleteMany({}), User.deleteMany({}), Subscription.deleteMany({}), JobAlertDelivery.deleteMany({}),
      JobAlertOutbox.deleteMany({}), TelegramChannelDelivery.deleteMany({}), TelegramChannelSchedule.deleteMany({}),
      TelegramBroadcastSettings.deleteMany({})]);
  };
  const publish = (fingerprint = 'outbox-fixture', extra = {}) => persistJobChangesWithAlertOutbox(Job, [{ updateOne: {
    filter: { fingerprint }, update: { $set: { fingerprint, title: 'Software Engineer', company: 'Example', city: 'Bengaluru',
      sourceUrl: 'https://example.com/jobs/test', status: 'active', ...extra } }, upsert: true,
  } }]);
  const subscriber = (email, extra = {}) => User.create({ email,
    premium: { planId: 'semester', status: 'active', telegramAlertsEnabled: true },
    telegram: { chatId: email, linkedAt: new Date() }, profile: { telegramAlertFilters: { company: ['Example'] } }, ...extra });
  const configure = id => TelegramBroadcastSettings.create({ _id: id, enabled: true,
    chatId: id === 'channel' ? '@examplechannel' : '@examplegroup', filters: { company: ['Example'] },
    minIntervalMinutes: 2, maxIntervalMinutes: 3, template: DEFAULT_BROADCAST_TEMPLATE, revision: 1 });

  await t.test('failed outbox persistence rolls back a new job and updates in the same batch', async () => {
    await reset();
    const old = await Job.create({ fingerprint: 'existing', title: 'Before', company: 'Example' });
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: { status: { $ne: 'pending' } } });
    await assert.rejects(persistJobChangesWithAlertOutbox(Job, [
      { updateOne: { filter: { _id: old._id }, update: { $set: { title: 'After' } } } },
      { updateOne: { filter: { fingerprint: 'new' }, update: { $set: { title: 'New', company: 'Example', status: 'active' } }, upsert: true } },
    ]));
    assert.equal(await Job.countDocuments(), 1);
    assert.equal((await Job.findById(old._id)).title, 'Before');
    assert.equal(await JobAlertOutbox.countDocuments(), 0);
  });

  await t.test('529 fresh jobs use bounded bulk outbox writes and replay without duplicate alerts', async () => {
    await reset();
    const operations = Array.from({ length: 529 }, (_, index) => ({ updateOne: {
      filter: { fingerprint: `large-batch-${index}` },
      update: { $set: { fingerprint: `large-batch-${index}`, title: 'Engineer', company: 'Example', status: 'active' } },
      upsert: true,
    } }));
    const commands = [];
    const observe = event => {
      if (event.commandName === 'update' && ['jobs', 'jobalertoutboxes'].includes(event.command.update)) commands.push(event.command);
    };
    const client = mongoose.connection.getClient();
    client.on('commandStarted', observe);
    let result;
    try { result = await persistJobChangesWithAlertOutbox(Job, operations); }
    finally { client.off('commandStarted', observe); }
    assert.equal(result.upsertedCount, 529);
    assert.equal(Object.keys(result.upsertedIds).length, 529);
    assert.equal(new Set(Object.values(result.upsertedIds).map(String)).size, 529);
    assert.ok(commands.every(command => command.updates.length <= 100));
    assert.ok(commands.filter(command => command.update === 'jobalertoutboxes').length <= 6,
      'Large inventories must not make a separate network round trip for every alert.');
    assert.equal(await Job.countDocuments(), 529);
    assert.equal(await JobAlertOutbox.countDocuments(), 529);
    const replay = await persistJobChangesWithAlertOutbox(Job, operations);
    assert.equal(replay.upsertedCount, 0);
    assert.equal(await JobAlertOutbox.countDocuments(), 529);
  });

  await t.test('a later batch failure keeps earlier job-alert pairs atomic and safely resumable', async () => {
    await reset();
    const operations = Array.from({ length: 250 }, (_, index) => ({ updateOne: {
      filter: { fingerprint: `resume-batch-${index}` },
      update: { $set: { fingerprint: `resume-batch-${index}`, title: 'Engineer', status: 'active' } }, upsert: true,
    } }));
    const original = JobAlertOutbox.bulkWrite.bind(JobAlertOutbox);
    let writes = 0;
    const failure = new TypeError('injected outbox failure');
    const bulk = t.mock.method(JobAlertOutbox, 'bulkWrite', (...args) => {
      if (++writes === 2) throw failure;
      return original(...args);
    });
    try { await assert.rejects(persistJobChangesWithAlertOutbox(Job, operations), error => error === failure); }
    finally { bulk.mock.restore(); }
    assert.equal(await Job.countDocuments(), 100);
    assert.equal(await JobAlertOutbox.countDocuments(), 100);
    const resumed = await persistJobChangesWithAlertOutbox(Job, operations);
    assert.equal(resumed.upsertedCount, 150);
    assert.equal(await Job.countDocuments(), 250);
    assert.equal(await JobAlertOutbox.countDocuments(), 250);
  });

  await t.test('resuming a source attempt does not double-count unseen jobs or expire them early', async () => {
    await reset();
    const unseen = await Job.create({ fingerprint: 'unseen-lifecycle-job', title: 'Engineer', company: 'Example',
      source: 'lifecycle-fixture', status: 'active', missedScrapeCount: 0 });
    const options = { lifecycleAttemptId: 'stable-checkpoint-attempt', refreshDatasetSummary: false, enrichPublicExperience: false };
    await saveToDB(source, 'lifecycle-fixture', options);
    assert.equal((await Job.findById(unseen._id)).missedScrapeCount, 1);
    await saveToDB(source, 'lifecycle-fixture', options);
    const resumed = await Job.findById(unseen._id);
    assert.ok(resumed, 'A resumed attempt must not turn one missing inventory into two misses.');
    assert.equal(resumed.missedScrapeCount, 1);
    await saveToDB(source, 'lifecycle-fixture', { ...options, lifecycleAttemptId: 'next-scheduled-attempt' });
    assert.equal(await Job.findById(unseen._id), null);
  });

  await t.test('restart recovery persists matching deliveries and completion without sending', async () => {
    await reset(); const owner = await subscriber('owner@example.test');
    await subscriber('opted-out@example.test', { premium: { planId: 'semester', status: 'active', telegramAlertsEnabled: false } });
    await subscriber('unmatched@example.test', { profile: { telegramAlertFilters: { company: ['Different'] } } });
    await updateAlertSchedule(owner._id, { frequency: 'daily', isActive: false, deliveryTime: '10:30', weeklyDay: 'Monday' });
    await publish();
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 1, failed: 0 });
    const delivery = await JobAlertDelivery.findOne();
    assert.equal(await JobAlertDelivery.countDocuments(), 1);
    assert.equal(String(delivery.user), String(owner._id));
    assert.equal(delivery.schedulePaused, true);
    assert.ok(delivery.scheduledFor > new Date());
    assert.equal((await JobAlertOutbox.findOne()).status, 'completed');
  });

  await t.test('claim expiry recovers work and excludes the original worker', async () => {
    await reset(); await subscriber('owner@example.test'); await publish();
    const stale = await claimJobAlertEvent();
    assert.equal(await claimJobAlertEvent(), null);
    await JobAlertOutbox.updateOne({ _id: stale._id }, { $set: { claimExpiresAt: new Date(0) } });
    const current = await claimJobAlertEvent();
    assert.notEqual(current.claimToken, stale.claimToken);
    assert.equal(await processClaimedJobAlertEvent(stale), false);
    assert.equal(await processClaimedJobAlertEvent(current), true);
    assert.equal(await JobAlertDelivery.countDocuments(), 1);
  });

  await t.test('completion failure rolls back all recipient rows and schedules a retry', async () => {
    await reset(); await subscriber('owner@example.test'); await publish();
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: { status: { $ne: 'completed' } } });
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 0, failed: 1 });
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
    const failed = await JobAlertOutbox.findOne();
    assert.equal(failed.status, 'pending');
    assert.ok(failed.nextAttemptAt > new Date());
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: {} });
    await JobAlertOutbox.updateOne({ _id: failed._id }, { $set: { nextAttemptAt: new Date(0) } });
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 1, failed: 0 });
    assert.equal(await JobAlertDelivery.countDocuments(), 1);
  });

  await t.test('concurrent workers and replay after delivery cleanup cannot fan out twice', async () => {
    await reset(); await subscriber('owner@example.test'); await publish();
    const event = await claimJobAlertEvent();
    const outcomes = await Promise.all([processClaimedJobAlertEvent(event), processClaimedJobAlertEvent(event)]);
    assert.equal(outcomes.filter(Boolean).length, 1);
    assert.equal(await JobAlertDelivery.countDocuments(), 1);
    await JobAlertDelivery.deleteMany({}); // The sender cleans up acknowledged rows.
    assert.equal(await processClaimedJobAlertEvent(event), false);
    await publish('outbox-fixture', { title: 'Updated job description' });
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 0, failed: 0 });
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
    assert.equal(await JobAlertOutbox.countDocuments(), 1);
  });

  await t.test('inactive inserts do not alert and jobs removed before fanout complete safely', async () => {
    await reset(); await publish('inactive', { status: 'expired' });
    assert.equal(await JobAlertOutbox.countDocuments(), 0);
    await publish('removed'); await Job.deleteMany({});
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 1, failed: 0 });
    assert.equal((await JobAlertOutbox.findOne()).outcome, 'job_unavailable');
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
  });

  await t.test('channel fanout commits with the publication receipt and rolls back on completion failure', async () => {
    await reset(); await configure('channel');
    await publish('channel-transaction');
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: { status: { $ne: 'completed' } } });
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 0, failed: 1 });
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
    assert.equal(await TelegramChannelSchedule.countDocuments(), 0);
    assert.equal((await TelegramBroadcastSettings.findById('channel')).dispatchRevision, 0);
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: {} });
    await JobAlertOutbox.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 1, failed: 0 });
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'queued', destination: 'channel', configRevision: 1 }), 1);
    assert.equal(await TelegramChannelSchedule.countDocuments(), 1);
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
    assert.equal((await TelegramBroadcastSettings.findById('channel')).dispatchRevision, 1);
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 0, failed: 0 });
    assert.equal(await TelegramChannelDelivery.countDocuments(), 1);
  });
  await t.test('a group staging failure rolls back both public queues and the personal fanout', async () => {
    await reset(); await subscriber('personal-member@example.test');
    await configure('channel'); await configure('group');
    await publish('group-staging-failure');
    await mongoose.connection.db.command({ collMod: 'telegramchanneldeliveries', validator: { destination: { $ne: 'group' } } });
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 0, failed: 1 });
    assert.equal((await JobAlertOutbox.findOne()).status, 'pending');
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
    assert.equal(await TelegramChannelSchedule.countDocuments(), 0);
    assert.equal(await TelegramBroadcastSettings.countDocuments({ dispatchRevision: 0 }), 2);
    await mongoose.connection.db.command({ collMod: 'telegramchanneldeliveries', validator: {} });
    await JobAlertOutbox.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 1, failed: 0 });
    assert.equal(await TelegramChannelDelivery.countDocuments(), 2);
    assert.equal(await JobAlertDelivery.countDocuments(), 1);
    assert.equal(await TelegramBroadcastSettings.countDocuments({ dispatchRevision: 1 }), 2);
  });
});
