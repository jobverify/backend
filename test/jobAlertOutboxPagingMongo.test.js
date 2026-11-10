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
import { alertScheduleService, updateAlertSchedule } from '../src/services/alertScheduleService.js';
import { claimJobAlertEvent, processClaimedJobAlertEvent, recoverJobAlertOutbox } from '../src/services/jobAlertOutboxService.js';

test('outbox recipient paging keeps durable bounded progress', { timeout: 180_000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  const mongo = await MongoMemoryReplSet.create({
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) },
    instanceOpts: [{ launchTimeout: 30_000 }], replSet: { count: 1 },
  });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  const connect = () => mongoose.connect(mongo.getUri(), { monitorCommands: true });
  await connect();
  const models = [Job, User, Subscription, JobAlertDelivery, JobAlertOutbox,
    TelegramChannelDelivery, TelegramChannelSchedule, TelegramBroadcastSettings];
  await Promise.all(models.map(model => model.init()));
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external request in paging regression.'); });
  const reset = async () => {
    await mongoose.connection.db.command({ collMod: 'jobalertdeliveries', validator: {} });
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: {} });
    await Promise.all(models.map(model => model.deleteMany({})));
  };
  const seed = async count => {
    // Explicit arbitrary identifiers exercise _id ordering independently of enrollment time.
    const users = await User.insertMany(Array.from({ length: count }, (_, i) => ({
      _id: new mongoose.Types.ObjectId((i + 1).toString(16).padStart(24, '0')),
      email: `paging-${i}@example.test`,
      premium: { planId: 'semester', status: 'active', telegramAlertsEnabled: true },
      telegram: { chatId: `paging-${i}`, linkedAt: new Date() },
      profile: { branch: 'Computer Science', passingYear: 2026, telegramAlertFilters: { company: ['Example'] } },
    })));
    const job = await Job.create({ fingerprint: 'paging', title: 'Engineer', company: 'Example', status: 'active',
      branches: ['Computer Science'], eligibleBatches: [2026] });
    // Raw insert exercises legacy receipts with no paging fields/defaults.
    await JobAlertOutbox.collection.insertOne({ job: job._id, kind: 'job_published', status: 'pending',
      nextAttemptAt: new Date(0), attemptCount: 0, createdAt: new Date() });
    return { users, job };
  };
  const channel = () => TelegramBroadcastSettings.create({ _id: 'channel', enabled: true,
    chatId: '@pagingchannel', filters: { company: ['Example'] }, minIntervalMinutes: 2, maxIntervalMinutes: 3,
    template: DEFAULT_BROADCAST_TEMPLATE, revision: 1 });
  const forbidRecipient = user => mongoose.connection.db.command({ collMod: 'jobalertdeliveries',
    validator: { user: { $ne: user._id } } });
  const retryNow = () => JobAlertOutbox.updateMany({ status: 'pending' }, { $set: { nextAttemptAt: new Date(0) } });

  await t.test('legacy users without an explicit deactivation flag remain eligible through the write fence', async () => {
    await reset(); const { users } = await seed(2);
    await User.updateOne({ _id: users[0]._id }, { $unset: { deactivated: '' } });
    await User.updateOne({ _id: users[1]._id }, { $set: { deactivated: true } });
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 1, failed: 0 });
    assert.equal(await JobAlertDelivery.countDocuments({ user: users[0]._id }), 1);
    assert.equal(await JobAlertDelivery.countDocuments({ user: users[1]._id }), 0);
  });

  await t.test('a slice stops after ten projected 100-recipient pages and defers channels until completion', async () => {
    await reset(); const { users } = await seed(1005); await channel();
    const queries = [];
    const observe = command => { if (command.command.find === 'users') queries.push(command.command); };
    mongoose.connection.getClient().on('commandStarted', observe);
    try {
      assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 0, failed: 0 });
      const partial = await JobAlertOutbox.findOne().lean();
      assert.equal(partial.status, 'pending');
      assert.equal(partial.claimToken, null);
      assert.ok(partial.nextAttemptAt <= new Date());
      assert.equal(String(partial.recipientCursor), String(users[999]._id));
      assert.equal(String(partial.recipientUpperBound), String(users[1004]._id));
      assert.equal(await JobAlertDelivery.countDocuments(), 1000);
      assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
      assert.ok(queries.length >= 10);
      for (const query of queries) {
        assert.ok(query.limit > 0 && query.limit <= 100, 'No recipient query may materialize an unbounded audience.');
        assert.ok(query.projection?._id, 'Recipient queries must project fields explicitly.');
        assert.equal(query.projection?.email, undefined);
        assert.equal(query.projection?.password, undefined);
      }
      assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 1, failed: 0 });
      assert.equal(await JobAlertDelivery.countDocuments(), 1005);
      assert.equal(await TelegramChannelDelivery.countDocuments(), 1);
      assert.equal((await TelegramBroadcastSettings.findById('channel')).dispatchRevision, 1);
    } finally { mongoose.connection.getClient().off('commandStarted', observe); }
  });

  await t.test('later-page failure rolls back only that page; restart skips cleaned sent rows and keeps the upper bound', async () => {
    await reset(); const { users } = await seed(205); await channel();
    await updateAlertSchedule(users[150]._id, { frequency: 'weekly', isActive: false, deliveryTime: '10:30', weeklyDay: 'Monday' });
    await forbidRecipient(users[150]);
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 0, failed: 1 });
    const failed = await JobAlertOutbox.findOne().lean();
    assert.equal(String(failed.recipientCursor), String(users[99]._id));
    assert.equal(await JobAlertDelivery.countDocuments(), 100);
    assert.equal(await Subscription.countDocuments({ dispatchRevision: 1 }), 100);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
    await JobAlertDelivery.updateMany({}, { $set: { status: 'sent' } });
    await JobAlertDelivery.deleteMany({ status: 'sent' });
    await User.create({ _id: new mongoose.Types.ObjectId('ffffffffffffffffffffffff'), email: 'later@example.test',
      premium: { planId: 'semester', status: 'active', telegramAlertsEnabled: true },
      telegram: { chatId: 'later', linkedAt: new Date() }, profile: { telegramAlertFilters: { company: ['Example'] } } });
    await mongoose.connection.db.command({ collMod: 'jobalertdeliveries', validator: {} });
    await mongoose.disconnect(); await connect();
    await retryNow();
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 1, failed: 0 });
    assert.equal(await JobAlertDelivery.countDocuments(), 105, 'Committed recipients cannot be reinserted after sender cleanup.');
    assert.equal(await JobAlertDelivery.countDocuments({ user: { $in: users.slice(0, 100).map(user => user._id) } }), 0);
    assert.equal((await JobAlertDelivery.findOne({ user: users[150]._id })).schedulePaused, true);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 1);
    await JobAlertDelivery.deleteMany({}); await TelegramChannelDelivery.deleteMany({});
    assert.deepEqual(await recoverJobAlertOutbox(), { completed: 0, failed: 0 });
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
  });

  await t.test('an expired worker cannot advance a committed cursor or finish after another claim', async st => {
    await reset(); await seed(205); await channel();
    const stale = await claimJobAlertEvent();
    const transact = mongoose.connection.transaction.bind(mongoose.connection);
    let replacement;
    st.mock.method(mongoose.connection, 'transaction', async (...args) => {
      const result = await transact(...args);
      if (!replacement && await JobAlertDelivery.countDocuments() === 100) {
        await JobAlertOutbox.updateOne({ _id: stale._id }, { $set: { claimExpiresAt: new Date(0) } });
        replacement = await claimJobAlertEvent();
      }
      return result;
    });
    assert.equal(await processClaimedJobAlertEvent(stale), false);
    assert.ok(replacement);
    assert.equal(await JobAlertDelivery.countDocuments(), 100);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
    assert.equal(String((await JobAlertOutbox.findById(stale._id)).recipientCursor), '000000000000000000000064');
    assert.equal(await processClaimedJobAlertEvent(replacement), true);
    assert.equal(await JobAlertDelivery.countDocuments(), 205);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 1);
  });

  await t.test('terminal completion failure preserves earlier pages and rolls back the final page with channels', async () => {
    await reset(); const { users } = await seed(205); await channel();
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: { status: { $ne: 'completed' } } });
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 0, failed: 1 });
    assert.equal(await JobAlertDelivery.countDocuments(), 200);
    assert.equal(String((await JobAlertOutbox.findOne()).recipientCursor), String(users[199]._id));
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
    assert.equal(await TelegramChannelSchedule.countDocuments(), 0);
    assert.equal((await TelegramBroadcastSettings.findById('channel')).dispatchRevision, 0);
    await JobAlertDelivery.deleteMany({});
    await mongoose.connection.db.command({ collMod: 'jobalertoutboxes', validator: {} });
    await retryNow();
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 1, failed: 0 });
    assert.equal(await JobAlertDelivery.countDocuments(), 5);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 1);
    assert.equal((await TelegramBroadcastSettings.findById('channel')).dispatchRevision, 1);
  });

  await t.test('a purge after a committed page cannot recreate deliveries on retry', async () => {
    await reset(); const { users, job } = await seed(205);
    await forbidRecipient(users[150]);
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 0, failed: 1 });
    assert.equal(await JobAlertDelivery.countDocuments(), 100);
    await JobAlertDelivery.deleteMany({ job: job._id });
    await Job.deleteOne({ _id: job._id });
    await JobAlertDelivery.deleteMany({ job: job._id });
    await retryNow();
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 1, failed: 0 });
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
    assert.equal((await JobAlertOutbox.findOne()).outcome, 'job_unavailable');
  });

  await t.test('a pause committed after recipient selection is reflected in the staged delivery', async st => {
    await reset(); const { users } = await seed(105);
    const queue = alertScheduleService.queueDeliveries;
    let paused = false;
    st.mock.method(alertScheduleService, 'queueDeliveries', async (...args) => {
      if (!paused) {
        paused = true;
        await updateAlertSchedule(users[0]._id, { frequency: 'weekly', isActive: false, deliveryTime: '10:30', weeklyDay: 'Monday' });
      }
      return queue(...args);
    });
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 1, failed: 0 });
    assert.equal(await JobAlertDelivery.countDocuments(), 105);
    const delivery = await JobAlertDelivery.findOne({ user: users[0]._id });
    assert.equal(delivery.schedulePaused, true);
    assert.equal(delivery.scheduleVersion, 1);
    assert.equal((await Subscription.findOne({ user: users[0]._id })).dispatchRevision, 1);
  });

  await t.test('account deletion after a page read conflicts with its identity fence and never restores private rows', async st => {
    await reset(); const { users } = await seed(105);
    const deleted = users[0];
    const execute = User.Query.prototype.exec;
    let removed = false;
    st.mock.method(User.Query.prototype, 'exec', async function (...args) {
      const result = await execute.apply(this, args);
      if (!removed && this.op === 'find' && this.getOptions().session?.inTransaction()) {
        removed = true;
        await User.deleteOne({ _id: deleted._id });
        await Subscription.deleteMany({ user: deleted._id });
        await JobAlertDelivery.deleteMany({ user: deleted._id });
      }
      return result;
    });
    assert.deepEqual(await recoverJobAlertOutbox({ limit: 1 }), { completed: 1, failed: 0 });
    assert.equal(removed, true);
    assert.equal(await JobAlertDelivery.countDocuments(), 104);
    assert.equal(await JobAlertDelivery.countDocuments({ user: deleted._id }), 0);
    assert.equal(await Subscription.countDocuments({ user: deleted._id }), 0);
    assert.equal((await alertScheduleService.getSchedule(users[1]._id)).isActive, true);
  });
});
