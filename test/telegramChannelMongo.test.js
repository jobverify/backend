import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import TelegramBroadcastSettings from '../src/models/TelegramBroadcastSettings.js';
import TelegramChannelDelivery from '../src/models/TelegramChannelDelivery.js';
import TelegramChannelSchedule from '../src/models/TelegramChannelSchedule.js';
import { DEFAULT_BROADCAST_TEMPLATE } from '../src/services/telegramBroadcastTemplate.js';
import { saveBroadcastSettings, listBroadcastSettings } from '../src/services/telegramBroadcastSettingsService.js';
import { stageTelegramChannelDeliveries, recoverTelegramChannelAlerts, nextChannelPostAt } from '../src/services/telegramChannelService.js';

test('channel interval includes the default 20 and 30 minute boundaries', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  assert.equal(nextChannelPostAt(now, (min, max) => {
    assert.equal(min, 1_200_000); assert.equal(max, 1_800_001); return min;
  }).getTime() - now, 1_200_000);
  assert.equal(nextChannelPostAt(now, (_min, max) => max - 1).getTime() - now, 1_800_000);
});

test('channel interval uses each destination configured random or fixed range', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  assert.equal(nextChannelPostAt(now, (min, max) => {
    assert.equal(min, 120_000); assert.equal(max, 420_001); return max - 1;
  }, { minIntervalMinutes: 2, maxIntervalMinutes: 7 }).getTime() - now, 420_000);
  assert.equal(nextChannelPostAt(now, min => min,
    { minIntervalMinutes: 9, maxIntervalMinutes: 9 }).getTime() - now, 540_000);
});

test('admin broadcast queues are independent, durable, filtered and paced', { timeout: 120_000 }, async t => {
  const transportKeys = ['TELEGRAM_ENABLED', 'TELEGRAM_BOT_TOKEN'];
  const beforeEnv = Object.fromEntries(transportKeys.map(key => [key, process.env[key]]));
  const mongo = new MongoMemoryReplSet({
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) },
    instanceOpts: [{ launchTimeout: 30_000 }], replSet: { count: 1, spawn: { signal: t.signal } },
  });
  let startup;
  t.after(async () => {
    try { await mongoose.disconnect(); }
    finally {
      try { await mongo.stop({ doCleanup: false }); }
      finally { await startup?.catch(() => {}); await mongo.stop(); }
      for (const key of transportKeys) {
        if (beforeEnv[key] === undefined) delete process.env[key]; else process.env[key] = beforeEnv[key];
      }
    }
  });
  startup = mongo.start(); await startup; t.signal.throwIfAborted();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Job.init(), TelegramBroadcastSettings.init(), TelegramChannelDelivery.init(), TelegramChannelSchedule.init()]);
  Object.assign(process.env, { TELEGRAM_ENABLED: 'true', TELEGRAM_BOT_TOKEN: 'broadcast-fixture-token' });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('External sends are forbidden in broadcast tests.'); });
  let seq = 0;
  const configure = (id = 'channel', extra = {}) => TelegramBroadcastSettings.create({
    _id: id, enabled: true, chatId: id === 'channel' ? '@examplechannel' : '@examplegroup',
    minIntervalMinutes: 2, maxIntervalMinutes: 3, filters: { company: ['Example'] },
    matchAll: false, template: DEFAULT_BROADCAST_TEMPLATE, revision: 1, ...extra,
  });
  const job = (extra = {}) => Job.create({ title: `Developer ${++seq}`, company: 'Example', city: 'Bangalore',
    status: 'active', fingerprint: `broadcast-${seq}`, sourceUrl: `https://example.test/jobs/${seq}`, ...extra });
  const reset = async ({ channel = true } = {}) => {
    process.env.TELEGRAM_ENABLED = 'true';
    await Promise.all([Job.deleteMany({}), TelegramBroadcastSettings.deleteMany({}),
      TelegramChannelDelivery.deleteMany({}), TelegramChannelSchedule.deleteMany({})]);
    if (channel) await configure();
  };
  const due = () => TelegramChannelSchedule.updateMany({}, { $set: { nextPostAt: new Date(0) } });
  const send = async payload => ({ providerName: 'telegram', providerMessageId: payload.body.match(/Developer \d+/)?.[0] || '1' });
  const assertNoSend = async () => {
    const messages = [];
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async payload => { messages.push(payload); return send(payload); } } });
    assert.equal(messages.length, 0, 'No broadcast should be sent.');
  };

  for (const id of ['channel', 'group']) {
    await t.test(`${id} dynamic slots persist, pace queued jobs, hold gaps and resume after deleting all slots`, async st => {
      st.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T03:30:00Z') });
      await reset({ channel: false }); await configure(id, { minIntervalMinutes: 20, maxIntervalMinutes: 20 });
      const current = (await listBroadcastSettings()).find(item => item.id === id);
      const { id: _id, stats: _stats, ...body } = current;
      const postingWindows = [{ startTime: '09:00', endTime: '09:30' }, { startTime: '16:00', endTime: '17:00' }];
      let saved = await saveBroadcastSettings(id, { ...body, postingWindows }, new mongoose.Types.ObjectId());
      assert.deepEqual(saved.postingWindows, postingWindows);
      await stageTelegramChannelDeliveries([await job(), await job(), await job()]);
      const targets = [];
      const provider = { sendTextMessage: async payload => { targets.push(payload.chatId); return send(payload); } };
      await recoverTelegramChannelAlerts({ provider });
      assert.equal(targets.length, 0);
      st.mock.timers.setTime(new Date('2026-11-04T03:50:00Z').getTime());
      await recoverTelegramChannelAlerts({ provider }); assert.equal(targets.length, 1);
      assert.equal((await TelegramChannelSchedule.findById(saved.chatId)).nextPostAt.toISOString(), '2026-11-04T10:30:00.000Z');
      st.mock.timers.setTime(new Date('2026-11-04T06:00:00Z').getTime());
      await due(); await recoverTelegramChannelAlerts({ provider }); assert.equal(targets.length, 1);
      st.mock.timers.setTime(new Date('2026-11-04T10:30:00Z').getTime());
      await recoverTelegramChannelAlerts({ provider }); assert.equal(targets.length, 2);
      saved = await saveBroadcastSettings(id, { ...body, revision: saved.revision, postingWindows: [] }, new mongoose.Types.ObjectId());
      assert.deepEqual(saved.postingWindows, []); assert.equal(saved.stats.nextPostAt, null);
      assert.equal((await TelegramChannelSchedule.findById(saved.chatId)).nextPostAt, null);
      await stageTelegramChannelDeliveries([await job()]); await due(); await assertNoSend();
      assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'queued' }), 2);
      saved = await saveBroadcastSettings(id, { ...body, revision: saved.revision, postingWindows }, new mongoose.Types.ObjectId());
      assert.deepEqual((await listBroadcastSettings()).find(item => item.id === id).postingWindows, postingWindows);
      st.mock.timers.setTime(new Date('2026-11-04T10:50:00Z').getTime());
      await recoverTelegramChannelAlerts({ provider }); assert.equal(targets.length, 3);
    });
  }

  await t.test('midnight queues wait for independent channel and group openings, then pause at closing', async st => {
    st.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-03T18:30:00Z') });
    await reset();
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { startTime: '09:00', endTime: '21:00' } });
    await configure('group', { startTime: '10:00', endTime: '20:00' });
    await stageTelegramChannelDeliveries([await job(), await job()]);
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'queued' }), 4);
    assert.equal((await TelegramChannelSchedule.findById('@examplechannel')).nextPostAt.toISOString(), '2026-11-04T03:30:00.000Z');
    assert.equal((await TelegramChannelSchedule.findById('@examplegroup')).nextPostAt.toISOString(), '2026-11-04T04:30:00.000Z');
    await due(); await assertNoSend();
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'queued' }), 4);
    const targets = [];
    const provider = { sendTextMessage: async payload => { targets.push(payload.chatId); return send(payload); } };
    st.mock.timers.setTime(new Date('2026-11-04T03:30:00Z').getTime());
    await recoverTelegramChannelAlerts({ provider });
    assert.deepEqual(targets, ['@examplechannel']);
    st.mock.timers.setTime(new Date('2026-11-04T04:30:00Z').getTime());
    await recoverTelegramChannelAlerts({ provider });
    assert.deepEqual(targets, ['@examplechannel', '@examplechannel', '@examplegroup']);
    st.mock.timers.setTime(new Date('2026-11-04T15:30:00Z').getTime());
    await due(); await assertNoSend();
    assert.equal(await TelegramChannelDelivery.countDocuments({ destination: 'group', status: 'queued' }), 1);
  });

  for (const id of ['channel', 'group']) {
    await t.test(`${id} window survives saving and moves its queued schedule to the next opening`, async st => {
      st.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-03T18:30:00Z') });
      await reset({ channel: false }); await configure(id);
      await stageTelegramChannelDeliveries([await job()]);
      const current = (await listBroadcastSettings()).find(item => item.id === id);
      const { id: _id, stats: _stats, ...body } = current;
      const saved = await saveBroadcastSettings(id, { ...body, startTime: '09:00', endTime: '21:00' }, new mongoose.Types.ObjectId());
      assert.equal(saved.startTime, '09:00'); assert.equal(saved.endTime, '21:00');
      assert.equal(saved.stats.nextPostAt.toISOString(), '2026-11-04T03:30:00.000Z');
      assert.equal((await listBroadcastSettings()).find(item => item.id === id).startTime, '09:00');
      assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'queued' }), 1);
    });
  }

  await t.test('a worker crossing the closing boundary leaves the job queued', async st => {
    st.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T15:29:59Z') });
    await reset();
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { startTime: '09:00', endTime: '21:00' } });
    await stageTelegramChannelDeliveries([await job()]); await due();
    const find = Job.findById.bind(Job);
    st.mock.method(Job, 'findById', (...args) => {
      const query = find(...args); const lean = query.lean.bind(query);
      query.lean = async () => {
        const listing = await lean();
        st.mock.timers.setTime(new Date('2026-11-04T15:30:00Z').getTime());
        return listing;
      };
      return query;
    });
    await assertNoSend();
    assert.equal((await TelegramChannelDelivery.findOne()).status, 'queued');
    assert.equal((await TelegramChannelSchedule.findById('@examplechannel')).nextPostAt.toISOString(), '2026-11-05T03:30:00.000Z');
  });

  await t.test('missing or disabled admin settings stage no broadcasts', async () => {
    await reset({ channel: false }); const listing = await job();
    await stageTelegramChannelDeliveries([listing]);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
    await configure('channel', { enabled: false });
    await stageTelegramChannelDeliveries([listing]);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
    assert.equal(await TelegramChannelSchedule.countDocuments(), 0);
  });

  await t.test('a send transaction completing at closing requeues without contacting Telegram', async st => {
    st.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T15:29:59Z') });
    await reset();
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { startTime: '09:00', endTime: '21:00' } });
    await stageTelegramChannelDeliveries([await job()]); await due();
    const transaction = mongoose.connection.transaction.bind(mongoose.connection);
    st.mock.method(mongoose.connection, 'transaction', async (...args) => {
      const result = await transaction(...args);
      st.mock.timers.setTime(new Date('2026-11-04T15:30:00Z').getTime());
      return result;
    });
    await assertNoSend();
    assert.equal((await TelegramChannelDelivery.findOne()).status, 'queued');
    assert.equal((await TelegramChannelSchedule.findById('@examplechannel')).nextPostAt.toISOString(), '2026-11-05T03:30:00.000Z');
  });

  await t.test('rate-limit retry-after falling in quiet hours waits until the next opening', async st => {
    st.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T14:30:00Z') });
    await reset();
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { startTime: '09:00', endTime: '21:00' } });
    await stageTelegramChannelDeliveries([await job()]); await due();
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async () => {
      throw Object.assign(new Error('Rate limited'), { statusCode: 429, retryAfterSeconds: 7200 });
    } } });
    const receipt = await TelegramChannelDelivery.findOne();
    assert.equal(receipt.status, 'queued');
    assert.equal(receipt.retryAt.toISOString(), '2026-11-05T03:30:00.000Z');
    assert.equal((await TelegramChannelSchedule.findById('@examplechannel')).nextPostAt.toISOString(), '2026-11-05T03:30:00.000Z');
  });

  await t.test('matching jobs queue once without a member, wait initially and send one job per interval', async () => {
    await reset(); const jobs = [await job(), await job(), await job({ company: 'Other' })];
    const start = Date.now();
    await stageTelegramChannelDeliveries(jobs); await stageTelegramChannelDeliveries(jobs);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 2);
    assert.equal(await mongoose.connection.collection('users').countDocuments(), 0);
    const queued = await TelegramChannelDelivery.find().lean();
    assert.ok(queued.every(row => row.configRevision === 1 && row.destination === 'channel'));
    const schedule = await TelegramChannelSchedule.findById('@examplechannel').lean();
    assert.ok(schedule.nextPostAt.getTime() >= start + 120_000);
    assert.ok(schedule.nextPostAt.getTime() <= Date.now() + 180_000);
    const messages = []; const provider = { sendTextMessage: async payload => { messages.push(payload); return send(payload); } };
    await recoverTelegramChannelAlerts({ provider }); assert.equal(messages.length, 0);
    await due(); const sentStart = Date.now();
    await Promise.all([recoverTelegramChannelAlerts({ provider }), recoverTelegramChannelAlerts({ provider })]);
    assert.equal(messages.length, 1); assert.equal(messages[0].chatId, '@examplechannel');
    assert.ok(messages[0].body.endsWith('https://t.me/jobverifygroup'));
    assert.equal((messages[0].body.match(/is hiring/g) || []).length, 1);
    const after = await TelegramChannelSchedule.findById('@examplechannel').lean();
    assert.ok(after.nextPostAt.getTime() >= sentStart + 120_000);
    assert.ok(after.nextPostAt.getTime() <= Date.now() + 180_000);
    await recoverTelegramChannelAlerts({ provider }); assert.equal(messages.length, 1);
    await stageTelegramChannelDeliveries(jobs); assert.equal(await TelegramChannelDelivery.countDocuments(), 2);
    await due(); await recoverTelegramChannelAlerts({ provider }); assert.equal(messages.length, 2);
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'sent' }), 2);
  });

  await t.test('public filters do not apply a personal branch or graduating year restriction', async () => {
    await reset();
    await stageTelegramChannelDeliveries([await job({ branches: ['CSE'], eligibleBatches: [2025] })]);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 1);
    await due(); let sent = 0;
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async payload => { sent++; return send(payload); } } });
    assert.equal(sent, 1);
  });

  await t.test('a concurrent settings save retries staging with the new filters and revision', async st => {
    await reset(); const originalMatch = await job(); const newMatch = await job({ company: 'Other' });
    const update = TelegramBroadcastSettings.updateOne.bind(TelegramBroadcastSettings);
    let changed = false;
    st.mock.method(TelegramBroadcastSettings, 'updateOne', (...args) => {
      if (!changed && args[2]?.session) {
        changed = true;
        return (async () => {
          await update({ _id: 'channel' }, { $set: { filters: { company: ['Other'] } }, $inc: { revision: 1 } });
          return update(...args);
        })();
      }
      return update(...args);
    });
    await stageTelegramChannelDeliveries([originalMatch, newMatch]);
    const rows = await TelegramChannelDelivery.find().lean();
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].job), String(newMatch._id));
    assert.equal(rows[0].configRevision, 2);
    assert.equal((await TelegramBroadcastSettings.findById('channel')).dispatchRevision, 1);
  });

  await t.test('empty filters require explicit match-all and aggregate or inactive jobs do not queue', async () => {
    await reset(); await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { filters: {} } });
    const listing = await job(); await stageTelegramChannelDeliveries([listing]);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 0);
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { matchAll: true }, $inc: { revision: 1 } });
    await stageTelegramChannelDeliveries([listing, await job({ status: 'expired' }),
      await job({ title: 'Current openings at Example', jobId: 'example-current-openings' })]);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 1);
  });

  await t.test('closed listings and current filters are rechecked before sending old queued jobs', async () => {
    await reset(); const listing = await job(); await stageTelegramChannelDeliveries([listing]);
    await Job.updateOne({ _id: listing._id }, { $set: { status: 'expired' } }); await due();
    await assertNoSend();
    assert.equal((await TelegramChannelDelivery.findOne()).status, 'skipped');
    await stageTelegramChannelDeliveries([await job()]);
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { filters: { company: ['Other'] } }, $inc: { revision: 1 } });
    await due(); await assertNoSend();
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'skipped' }), 2);
  });

  await t.test('queued jobs use the current admin template and configured fixed interval', async () => {
    await reset(); const listing = await job(); await stageTelegramChannelDeliveries([listing]);
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: {
      template: 'Role: {title}\nCompany: {company}\nApply: {jobUrl}', minIntervalMinutes: 7, maxIntervalMinutes: 7,
    }, $inc: { revision: 1 } });
    await due(); let sent; const start = Date.now();
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async payload => { sent = payload; return send(payload); } } });
    assert.ok(sent.body.startsWith(`Role: ${listing.title}\nCompany: Example\nApply: https://`));
    const row = await TelegramChannelDelivery.findOne().lean(); assert.equal(row.configRevision, 2);
    const schedule = await TelegramChannelSchedule.findById('@examplechannel').lean();
    assert.equal(schedule.nextPostAt - schedule.lastSentAt, 420_000);
    assert.ok(schedule.lastSentAt.getTime() >= start);
  });

  await t.test('admin disable pauses queued broadcasts and prevents new staging', async () => {
    await reset(); await stageTelegramChannelDeliveries([await job()]);
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { enabled: false }, $inc: { revision: 1 } });
    await stageTelegramChannelDeliveries([await job()]); await due();
    await assertNoSend();
    assert.equal(await TelegramChannelDelivery.countDocuments(), 1);
    assert.equal((await TelegramChannelDelivery.findOne()).status, 'queued');
  });

  await t.test('transport disable leaves queued receipts available for later recovery', async () => {
    await reset(); await stageTelegramChannelDeliveries([await job()]); await due();
    process.env.TELEGRAM_ENABLED = 'false';
    await assertNoSend();
    assert.equal((await TelegramChannelDelivery.findOne()).status, 'queued');
  });

  await t.test('changing chat IDs does not send the old destination queue', async () => {
    await reset(); const listing = await job(); await stageTelegramChannelDeliveries([listing]);
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { chatId: '@replacementchannel' }, $inc: { revision: 1 } });
    await stageTelegramChannelDeliveries([listing]); await due();
    const targets = [];
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async payload => { targets.push(payload.chatId); return send(payload); } } });
    assert.deepEqual(targets, ['@replacementchannel']);
    assert.equal((await TelegramChannelDelivery.findOne({ channel: '@examplechannel' })).status, 'queued');
  });

  await t.test('legacy receipts are skipped even when publication replay sees matching new settings', async () => {
    await reset(); const old = [await job(), await job(), await job()]; const current = await job();
    for (const [index, configRevision] of [undefined, 0, 1.5].entries()) {
      await TelegramChannelDelivery.create({ channel: '@examplechannel', job: old[index]._id, status: 'queued', configRevision });
    }
    await stageTelegramChannelDeliveries([...old, current]); await due();
    const bodies = [];
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async payload => { bodies.push(payload.body); return send(payload); } } });
    assert.equal(bodies.length, 1); assert.ok(bodies[0].includes(current.title));
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'skipped', reason: 'legacy_configuration' }), 3);
  });

  await t.test('a settings change while loading a job prevents sending with stale settings', async st => {
    await reset(); await stageTelegramChannelDeliveries([await job()]); await due();
    const find = Job.findById.bind(Job);
    st.mock.method(Job, 'findById', (...args) => {
      const query = find(...args); const lean = query.lean.bind(query);
      query.lean = async () => {
        const listing = await lean();
        await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { enabled: false }, $inc: { revision: 1 } });
        return listing;
      };
      return query;
    });
    await assertNoSend();
    assert.equal((await TelegramChannelDelivery.findOne()).status, 'queued');
  });

  for (const statusCode of [400, 401, 403, 404, 429]) {
    await t.test(`known provider rejection ${statusCode} remains retryable and observes its posting delay`, async () => {
      await reset(); await stageTelegramChannelDeliveries([await job()]); await due(); const start = Date.now();
      await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async () => {
        throw Object.assign(new Error('Rejected'), { statusCode, retryAfterSeconds: statusCode === 429 ? 3600 : null });
      } } });
      const row = await TelegramChannelDelivery.findOne().lean();
      assert.equal(row.status, 'queued'); assert.equal(row.reason, 'provider_rejected');
      assert.ok(row.retryAt.getTime() >= start + (statusCode === 429 ? 3_600_000 : 120_000));
      assert.equal((await TelegramChannelSchedule.findById('@examplechannel')).nextPostAt.getTime(), row.retryAt.getTime());
      await TelegramChannelDelivery.updateOne({ _id: row._id }, { $set: { retryAt: new Date(0) } }); await due();
      await recoverTelegramChannelAlerts({ provider: { sendTextMessage: send } });
      assert.equal((await TelegramChannelDelivery.findById(row._id)).status, 'sent');
    });
  }

  await t.test('network uncertainty and interrupted sends are retained without automatic duplicate posting', async () => {
    await reset(); await stageTelegramChannelDeliveries([await job()]); await due();
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async () => { throw new Error('Network timeout'); } } });
    assert.equal((await TelegramChannelDelivery.findOne()).status, 'uncertain');
    const next = await job(); await stageTelegramChannelDeliveries([next]);
    await TelegramChannelDelivery.updateOne({ job: next._id }, { $set: { status: 'sending' } }); await due();
    await assertNoSend();
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'uncertain' }), 2);
    await due(); await assertNoSend();
  });

  for (const statusCode of [200, 500, 502]) {
    await t.test(`ambiguous provider response ${statusCode} is held without reposting`, async () => {
      await reset(); await stageTelegramChannelDeliveries([await job()]); await due();
      await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async () => {
        throw Object.assign(new Error('Unconfirmed send'), { statusCode });
      } } });
      assert.equal((await TelegramChannelDelivery.findOne()).status, 'uncertain');
      await due(); await assertNoSend();
    });
  }

  await t.test('real provider truncated HTTP 200 responses are held without reposting', async st => {
    await reset(); await stageTelegramChannelDeliveries([await job()]); await due();
    st.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200,
      json: async () => { throw new SyntaxError('Truncated JSON'); } }));
    await recoverTelegramChannelAlerts();
    assert.equal((await TelegramChannelDelivery.findOne()).status, 'uncertain');
    await due(); await assertNoSend();
  });

  await t.test('channel and group use independent fixed intervals and templates', async () => {
    await reset();
    await TelegramBroadcastSettings.updateOne({ _id: 'channel' }, { $set: { minIntervalMinutes: 2, maxIntervalMinutes: 2 } });
    await configure('group', { minIntervalMinutes: 9, maxIntervalMinutes: 9, template: 'Group: {title}\n{jobUrl}' });
    const jobs = [await job(), await job()];
    await stageTelegramChannelDeliveries(jobs); await stageTelegramChannelDeliveries(jobs);
    assert.equal(await TelegramChannelDelivery.countDocuments(), 4);
    assert.equal(await TelegramChannelSchedule.countDocuments(), 2);
    const messages = []; const provider = { sendTextMessage: async payload => { messages.push(payload); return send(payload); } };
    await TelegramChannelSchedule.updateOne({ _id: '@examplechannel' }, { $set: { nextPostAt: new Date(0) } });
    await recoverTelegramChannelAlerts({ provider }); assert.deepEqual(messages.map(payload => payload.chatId), ['@examplechannel']);
    const channelSchedule = await TelegramChannelSchedule.findById('@examplechannel').lean();
    assert.equal(channelSchedule.nextPostAt - channelSchedule.lastSentAt, 120_000);
    await TelegramChannelSchedule.updateOne({ _id: '@examplegroup' }, { $set: { nextPostAt: new Date(0) } });
    await recoverTelegramChannelAlerts({ provider });
    assert.deepEqual(messages.map(payload => payload.chatId), ['@examplechannel', '@examplegroup']);
    assert.ok(messages[1].body.startsWith(`Group: ${jobs[0].title}\nhttps://`));
    const groupSchedule = await TelegramChannelSchedule.findById('@examplegroup').lean();
    assert.equal(groupSchedule.nextPostAt - groupSchedule.lastSentAt, 540_000);
    assert.equal((await TelegramChannelSchedule.findById('@examplechannel')).nextPostAt.getTime(), channelSchedule.nextPostAt.getTime());
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'sent', destination: 'group' }), 1);
  });

  await t.test('group-only operation supports a numeric basic-group ID', async () => {
    await reset({ channel: false }); await configure('group', { chatId: '-123456789' });
    await stageTelegramChannelDeliveries([await job()]); await due(); let target;
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async payload => { target = payload.chatId; return send(payload); } } });
    assert.equal(target, '-123456789');
    assert.equal((await TelegramChannelDelivery.findOne()).destination, 'group');
  });

  await t.test('a rejected channel send does not stop a group delivery', async () => {
    await reset(); await configure('group'); await stageTelegramChannelDeliveries([await job()]); await due();
    await recoverTelegramChannelAlerts({ provider: { sendTextMessage: async payload => {
      if (payload.chatId === '@examplechannel') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
      return send(payload);
    } } });
    assert.equal(await TelegramChannelDelivery.countDocuments({ channel: '@examplechannel', status: 'queued' }), 1);
    assert.equal(await TelegramChannelDelivery.countDocuments({ channel: '@examplegroup', status: 'sent' }), 1);
  });

  await t.test('concurrent workers cannot duplicate a busy channel and can deliver its independent group', async () => {
    await reset(); await configure('group'); await stageTelegramChannelDeliveries([await job()]); await due();
    assert.equal(await TelegramChannelDelivery.countDocuments(), 2);
    let began; const channelStarted = new Promise(resolve => { began = resolve; });
    let unblock; const channelResponse = new Promise(resolve => { unblock = resolve; });
    const targets = [];
    const provider = { sendTextMessage: async payload => {
      targets.push(payload.chatId);
      if (payload.chatId === '@examplechannel') { began(); await channelResponse; }
      return send(payload);
    } };
    const first = recoverTelegramChannelAlerts({ provider });
    try {
      await Promise.race([channelStarted, first.then(() => { assert.fail('The due channel did not start sending.'); })]);
      await recoverTelegramChannelAlerts({ provider });
    }
    finally { unblock(); await first; }
    assert.deepEqual(targets, ['@examplechannel', '@examplegroup']);
    assert.equal(await TelegramChannelDelivery.countDocuments({ status: 'sent' }), 2);
  });
});
