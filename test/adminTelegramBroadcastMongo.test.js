import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import TelegramBroadcastSettings from '../src/models/TelegramBroadcastSettings.js';
import TelegramChannelSchedule from '../src/models/TelegramChannelSchedule.js';
import TelegramChannelDelivery from '../src/models/TelegramChannelDelivery.js';
import AdminAudit from '../src/models/AdminAudit.js';
import { DEFAULT_BROADCAST_TEMPLATE } from '../src/services/telegramBroadcastTemplate.js';
import { stageTelegramChannelDeliveries } from '../src/services/telegramChannelService.js';

process.env.JWT_SECRET = 'admin-broadcast-fixture-secret-at-least-32-characters';
const { default: adminRoutes } = await import('../src/routes/adminRoutes.js');

test('admin owns separate Telegram broadcast configuration without member dependency', { timeout: 90000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), TelegramBroadcastSettings.init(), TelegramChannelSchedule.init(), TelegramChannelDelivery.init(), AdminAudit.init()]);
  const admin = await User.create({ email: 'broadcast-admin@example.test', isVerified: true, role: 'admin' });
  const member = await User.create({ email: 'unrelated-member@example.test', isVerified: true });
  const app = express(); app.use(express.json()); app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (user, path = '', method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/telegram-alerts${path}`, {
      method, headers: { ...(user ? { authorization: `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}` } : {}), 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }); return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text() };
  };
  const draft = { enabled: true, chatId: '@samplechannel', minIntervalMinutes: 20, maxIntervalMinutes: 30,
    matchAll: false, filters: { company: ['Example'] }, template: DEFAULT_BROADCAST_TEMPLATE, revision: 0 };
  assert.equal((await request(null)).status, 401);
  for (const [path, method, body] of [['', 'GET'], ['/channel', 'PUT', draft], ['/preview', 'POST', { template: draft.template }], ['/logs', 'GET'], ['/channel/queue', 'DELETE'], ['/channel/history', 'DELETE']]) {
    assert.equal((await request(member, path, method, body)).status, 403);
  }
  const initial = await request(admin); assert.equal(initial.status, 200);
  assert.equal(initial.body.data.destinations.length, 2);
  assert.equal(initial.body.data.destinations[0].enabled, false);
  for (const overrides of [{ minIntervalMinutes: 0 }, { maxIntervalMinutes: 19 }, { enabled: 'true' }, { chatId: 'https://t.me/foo' },
    { filters: {}, matchAll: false }, { filters: { jobType: ['invalid'] } }, { filters: { jobType: ['Others'] } }, { template: '{postedAt} {jobUrl}' }]) {
    assert.equal((await request(admin, '/channel', 'PUT', { ...draft, ...overrides })).status, 400);
  }
  const legacy = await TelegramChannelDelivery.create({ channel: '@samplechannel', job: new mongoose.Types.ObjectId(), status: 'queued' });
  const saved = await request(admin, '/channel', 'PUT', draft); assert.equal(saved.status, 200);
  assert.equal((await TelegramChannelDelivery.findById(legacy._id)).reason, 'legacy_configuration');
  assert.equal(saved.body.data.revision, 1);
  assert.equal(saved.body.data.filters.company[0], 'Example');
  assert.equal((await request(admin, '/channel', 'PUT', draft)).status, 409);
  assert.equal((await request(admin, '/group', 'PUT', { ...draft, chatId: '@samplechannel' })).status, 400);
  const group = await request(admin, '/group', 'PUT', { ...draft, chatId: '-12345678', minIntervalMinutes: 45, maxIntervalMinutes: 45, matchAll: true,
    postingWindows: [{ startTime: '00:00', endTime: '23:59' }] });
  assert.equal(group.status, 200);
  const preview = await request(admin, '/preview', 'POST', { template: '{company}\n{salary}\n{jobUrl}', sample: 'minimal' });
  assert.equal(preview.status, 200); assert.doesNotMatch(preview.body.data.text, /salary/i);
  assert.equal((await request(admin, '/preview', 'POST', { template: '{unknown} {jobUrl}' })).status, 400);
  assert.equal((await request(admin, '/logs?destination=channel')).status, 200);
  await TelegramChannelSchedule.updateOne({ _id: '@samplechannel' }, { $set: { claimToken: 'inflight', claimExpiresAt: new Date(Date.now() + 60000) } });
  assert.equal((await request(admin, '/channel', 'PUT', { ...draft, revision: 1, enabled: false })).status, 409);
  await TelegramChannelSchedule.updateOne({ _id: '@samplechannel' }, { $set: { claimToken: null, claimExpiresAt: null } });
  assert.equal((await request(admin, '/channel', 'PUT', { ...draft, revision: 1, enabled: false })).status, 200);
  await User.deleteOne({ _id: member._id });
  assert.equal((await TelegramBroadcastSettings.findById('group')).enabled, true);
  assert.equal(await AdminAudit.countDocuments({ action: 'telegram_broadcast_settings_updated' }), 3);
  assert.doesNotMatch(JSON.stringify((await request(admin)).body), /FILTER_USER_EMAIL|BOT_TOKEN|filterOwner/);
  const pending = await TelegramChannelDelivery.create({ channel: '@samplechannel', destination: 'channel', configRevision: 2,
    job: new mongoose.Types.ObjectId(), status: 'queued' });
  const moved = await request(admin, '/channel', 'PUT', { ...draft, chatId: '@updatedchannel', revision: 2, enabled: false });
  assert.equal(moved.status, 200);
  assert.equal((await TelegramChannelDelivery.findById(pending._id)).reason, 'destination_changed');
  const history = await request(admin, '/logs?destination=channel');
  assert.equal(history.body.data.find(row => row.id === String(pending._id)).status, 'skipped');
  assert.equal((await request(null, '/channel/queue', 'DELETE')).status, 401);
  assert.equal((await request(admin, '/invalid/queue', 'DELETE')).status, 400);
  const queued = await TelegramChannelDelivery.create({ channel: '@updatedchannel', destination: 'channel',
    configRevision: 3, job: new mongoose.Types.ObjectId(), status: 'queued', retryAt: new Date() });
  const other = await TelegramChannelDelivery.create({ channel: '-12345678', destination: 'group',
    configRevision: 1, job: new mongoose.Types.ObjectId(), status: 'queued' });
  const sent = await TelegramChannelDelivery.create({ channel: '@updatedchannel', destination: 'channel',
    configRevision: 3, job: new mongoose.Types.ObjectId(), status: 'sent' });
  const cleared = await request(admin, '/channel/queue', 'DELETE');
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.data.clearedCount, 1);
  assert.equal(cleared.body.data.destination.stats.queued, 0);
  const receipt = await TelegramChannelDelivery.findById(queued._id).lean();
  assert.equal(receipt.status, 'skipped');
  assert.equal(receipt.reason, 'cleared_by_admin');
  assert.equal(receipt.retryAt, null);
  assert.equal((await TelegramChannelDelivery.findById(other._id)).status, 'queued');
  assert.equal((await TelegramChannelDelivery.findById(sent._id)).status, 'sent');
  assert.equal((await request(admin, '/channel/queue', 'DELETE')).body.data.clearedCount, 0);
  assert.equal(await AdminAudit.countDocuments({ action: 'telegram_broadcast_queue_cleared' }), 2);
  await TelegramChannelSchedule.updateOne({ _id: '-12345678' }, { $set: { claimToken: 'posting', claimExpiresAt: new Date(Date.now() + 60000) } });
  assert.equal((await request(admin, '/group/queue', 'DELETE')).status, 409);
  assert.equal((await TelegramChannelDelivery.findById(other._id)).status, 'queued');

  assert.equal((await request(null, '/channel/history', 'DELETE')).status, 401);
  assert.equal((await request(admin, '/invalid/history', 'DELETE')).status, 400);
  assert.equal((await request(admin, '/group/history', 'DELETE')).status, 409);
  assert.equal((await TelegramChannelDelivery.findById(other._id)).status, 'queued');
  await TelegramChannelSchedule.updateOne({ _id: '@updatedchannel' }, { $set: { lastSentAt: new Date() } });
  await TelegramChannelDelivery.create({ channel: '@updatedchannel', destination: 'channel',
    configRevision: 3, job: new mongoose.Types.ObjectId(), status: 'queued' });
  await TelegramChannelDelivery.create({ channel: '@updatedchannel', job: new mongoose.Types.ObjectId(), status: 'uncertain' });
  const beforeReset = await TelegramBroadcastSettings.findById('channel').lean();
  const reset = await request(admin, '/channel/history', 'DELETE');
  assert.equal(reset.status, 200);
  assert.deepEqual(reset.body.data.destination.stats, {
    queued: 0, sending: 0, sent: 0, skipped: 0, uncertain: 0, nextPostAt: null, lastSentAt: null,
  });
  assert.equal(await TelegramChannelDelivery.countDocuments({ destination: 'channel' }), 0);
  assert.equal(await TelegramChannelDelivery.countDocuments({ channel: '@updatedchannel' }), 0);
  assert.deepEqual((await request(admin, '/logs?destination=channel')).body.data, []);
  assert.equal((await TelegramChannelDelivery.findById(other._id)).status, 'queued');
  const afterReset = await TelegramBroadcastSettings.findById('channel').lean();
  for (const key of ['enabled', 'chatId', 'revision', 'template']) assert.equal(afterReset[key], beforeReset[key]);
  assert.equal(await AdminAudit.countDocuments({ action: 'telegram_broadcast_history_cleared' }), 1);
  assert.equal((await request(admin, '/channel/history', 'DELETE')).status, 200);
  await TelegramChannelSchedule.updateOne({ _id: '-12345678' }, { $set: { claimToken: null, claimExpiresAt: null } });
  const resetGroup = await request(admin, '/group/history', 'DELETE');
  assert.equal(resetGroup.status, 200);
  assert.equal(resetGroup.body.data.destination.enabled, true);
  assert.equal(resetGroup.body.data.destination.stats.nextPostAt, null);
  await stageTelegramChannelDeliveries([{ _id: new mongoose.Types.ObjectId(), status: 'active', title: 'Software Engineer', company: 'Example' }]);
  assert.equal(await TelegramChannelDelivery.countDocuments({ destination: 'group', status: 'queued' }), 1);
  assert.ok((await TelegramChannelSchedule.findById('-12345678')).nextPostAt > new Date());

});
