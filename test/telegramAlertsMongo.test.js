import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Subscription from '../src/models/Subscription.js';
import SiteSettings from '../src/models/SiteSettings.js';
import JobAlertDelivery from '../src/models/JobAlertDelivery.js';
import { queueJobAlertsForJobs, recoverQueuedJobAlerts, buildTelegramMessageBody } from '../src/services/jobAlertService.js';
import { updateAlertSchedule } from '../src/services/alertScheduleService.js';
import { createTelegramLinkToken } from '../src/services/telegramLinkService.js';
import { processTelegramWebhook } from '../src/controllers/telegramController.js';

test('Telegram alert delivery through matching, durable scheduling and provider responses', { timeout: 90000 }, async t => {
  const envKeys = ['MONGOMS_RUNTIME_DOWNLOAD', 'TELEGRAM_ENABLED', 'TELEGRAM_BOT_TOKEN', 'FRONTEND_ORIGIN'];
  const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  t.after(() => {
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  });
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.TELEGRAM_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = 'local-fixture-token';
  process.env.FRONTEND_ORIGIN = 'https://jobs.example.test';
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Job.init(), Subscription.init(), JobAlertDelivery.init()]);
  let sequence = 0;
  async function reset() { await Promise.all([User.deleteMany({}), Job.deleteMany({}), Subscription.deleteMany({}), JobAlertDelivery.deleteMany({})]); }
  const user = extra => User.create({ email: `candidate${++sequence}@example.test`,
    premium: { planId: 'semester', status: 'active', telegramAlertsEnabled: true },
    telegram: { chatId: String(sequence), linkedAt: new Date(Date.now() - 60000) },
    profile: { telegramAlertFilters: { company: ['Example'] } }, ...extra });
  const job = extra => Job.create({ title: `Developer ${++sequence}`, company: 'Example', city: 'Bengaluru',
    sourceUrl: `https://employer.example.test/jobs/${sequence}`, fingerprint: `telegram-${sequence}`, status: 'active', ...extra });
  function provider(st, respond = () => ({ ok: true, result: { message_id: 123 } })) {
    const requests = [];
    st.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, 'https://api.telegram.org/botlocal-fixture-token/sendMessage');
      const payload = JSON.parse(options.body); requests.push(payload);
      const body = respond(payload);
      return { ok: body.ok, status: body.ok ? 200 : body.error_code, json: async () => body };
    });
    return requests;
  }

  async function queueAndDeliverDueAlerts(jobs) {
    await queueJobAlertsForJobs(jobs);
    await JobAlertDelivery.updateMany({ status: 'queued' }, { $set: { scheduledFor: new Date(0) } });
    await recoverQueuedJobAlerts();
  }

  await t.test('default schedule holds jobs from multiple arrivals and sends each separately when due', async st => {
    await reset(); const owner = await user(); const requests = provider(st);
    const jobs = [await job(), await job(), await job()];
    await queueJobAlertsForJobs(jobs.slice(0, 1));
    await queueJobAlertsForJobs(jobs.slice(1));
    await recoverQueuedJobAlerts();
    assert.equal(requests.length, 0);
    const pending = await JobAlertDelivery.find({ user: owner._id }).lean();
    assert.equal(pending.length, 3);
    assert.equal(new Set(pending.map(row => row.scheduledFor.toISOString())).size, 1);
    await JobAlertDelivery.updateMany({}, { $set: { scheduledFor: new Date(0) } });
    await recoverQueuedJobAlerts();
    assert.equal(requests.length, 3);
    for (const listing of jobs) assert.equal(requests.filter(payload => payload.text.includes(listing.sourceUrl)).length, 1);
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
  });

  await t.test('delivery uses the latest personal template saved after queueing', async st => {
    await reset();
    const owner = await user();
    const listing = await job();
    const requests = provider(st);
    await queueJobAlertsForJobs([listing]);
    await User.updateOne({ _id: owner._id }, { $set: { 'profile.telegramAlertTemplate': '{title} at {company}\n{jobUrl}' } });
    await JobAlertDelivery.updateMany({}, { $set: { scheduledFor: new Date(0) } });
    await recoverQueuedJobAlerts();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].text, `${listing.title} at ${listing.company}\n${listing.sourceUrl}`);
  });

  await t.test('a scheduled send drains more than one recovery page in the same run', async st => {
    await reset(); const owner = await user(); const requests = provider(st);
    await updateAlertSchedule(owner._id, { frequency: 'daily', isActive: true, deliveryTime: '09:00', weeklyDay: 'Monday' });
    const jobs = await Job.insertMany(Array.from({ length: 501 }, (_, index) => ({
      title: `Developer ${index}`, company: 'Example', city: 'Bengaluru',
      fingerprint: `scheduled-page-${index}`, sourceUrl: `https://employer.example.test/jobs/page-${index}`, status: 'active',
    })));
    await JobAlertDelivery.insertMany(jobs.map(listing => ({ user: owner._id, job: listing._id, channel: 'telegram',
      status: 'queued', scheduledFor: new Date(0), scheduleVersion: 1 })));
    await recoverQueuedJobAlerts();
    assert.equal(requests.length, 501);
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
  });

  await t.test('legacy immediate queued jobs wait until their migrated daily schedule is due', async st => {
    await reset(); const owner = await user(); const listing = await job(); const requests = provider(st);
    await Subscription.collection.insertOne({ user: owner._id, telegramSchedule: {
      frequency: 'immediate', isActive: true, scheduleVersion: 0, deliveryTime: '09:00', weeklyDay: 'Monday',
    } });
    await JobAlertDelivery.create({ user: owner._id, job: listing._id, channel: 'telegram', status: 'queued',
      scheduledFor: new Date(0), scheduleVersion: 0 });
    await recoverQueuedJobAlerts();
    assert.equal(requests.length, 0);
    const pending = await JobAlertDelivery.findOne({ user: owner._id });
    assert.ok(pending.scheduledFor > new Date());
    assert.equal(pending.scheduleVersion, 1);
    await JobAlertDelivery.updateOne({ _id: pending._id }, { $set: { scheduledFor: new Date(0) } });
    await recoverQueuedJobAlerts();
    assert.equal(requests.length, 1);
  });

  await t.test('free mode delivers to linked opted-in free accounts and premium mode blocks them', async st => {
    await reset();
    await user({ premium: { planId: 'free', status: 'inactive', telegramAlertsEnabled: true } });
    const requests = provider(st);
    st.mock.method(SiteSettings, 'findById', () => ({ lean: async () => ({ billingEnabled: true }) }));
    await queueAndDeliverDueAlerts([await job()]);
    assert.equal(requests.length, 0);
    st.mock.method(SiteSettings, 'findById', () => ({ lean: async () => ({ billingEnabled: false }) }));
    await queueAndDeliverDueAlerts([await job()]);
    assert.equal(requests.length, 1);
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
  });

  await t.test('long job descriptions produce deliverable alerts without disabling the subscriber', async st => {
    await reset(); const owner = await user();
    const jobs = await Promise.all(Array.from({ length: 5 }, () => job({ description: 'Build and maintain web applications. '.repeat(80) })));
    const requests = provider(st, payload => payload.text.length > 4096
      ? { ok: false, error_code: 400, description: 'Bad Request: message is too long' }
      : { ok: true, result: { message_id: 123 } });
    await queueAndDeliverDueAlerts(jobs);
    assert.equal(requests.length, jobs.length, 'Each job must be sent in a separate Telegram message.');
    for (const [index, item] of jobs.entries()) {
      const body = requests[index].text;
      assert.ok(body.length <= 4096);
      assert.ok(body.startsWith(`📌 Example is hiring ${item.title}\n`));
      assert.ok(body.includes(item.sourceUrl));
      for (const other of jobs) if (other.id !== item.id) assert.equal(body.includes(other.sourceUrl), false);
    }
    assert.equal((await User.findById(owner._id)).premium.telegramAlertsEnabled, true);
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
    assert.ok((await Subscription.findOne({ user: owner._id })).telegramLastSentAt);
  });

  await t.test('admin-disabled accounts cannot stage alerts even in free mode', async st => {
    await reset();
    await user({ telegramAlertsAllowed: false });
    st.mock.method(SiteSettings, 'findById', () => ({ lean: async () => ({ billingEnabled: false }) }));
    const requests = provider(st);
    await queueAndDeliverDueAlerts([await job()]);
    assert.equal(requests.length, 0);
    assert.equal(await JobAlertDelivery.countDocuments(), 0);
  });

  await t.test('a bot link issued before admin disables access cannot link the account', async st => {
    await reset();
    const owner = await user();
    const { rawToken } = await createTelegramLinkToken(owner._id);
    await User.updateOne({ _id: owner._id }, { $set: { telegramAlertsAllowed: false } });
    const requests = provider(st);
    let status;
    await processTelegramWebhook({ telegramWebhookVerified: true, body: {
      message: { chat: { type: 'private', id: 'new-chat' }, text: `/start ${rawToken}` },
    } }, { status(value) { status = value; return this; }, json() {} });
    assert.equal(status, 200);
    assert.equal((await User.findById(owner._id)).telegram.chatId, owner.telegram.chatId);
    assert.equal(requests.length, 0);
  });

  await t.test('a stale save of a legacy account cannot undo admin disabling Telegram', async () => {
    await reset();
    const { insertedId } = await User.collection.insertOne({ email: 'legacy@example.test' });
    const stale = await User.findById(insertedId);
    assert.equal(stale.telegramAlertsAllowed, true);
    await User.updateOne({ _id: insertedId }, { $set: { telegramAlertsAllowed: false } });
    stale.profile.name = 'Updated profile';
    await stale.save();
    assert.equal((await User.findById(insertedId)).telegramAlertsAllowed, false);
  });

  await t.test('admin disabling Telegram prevents already queued alerts from sending', async st => {
    await reset();
    const owner = await user();
    const requests = provider(st);
    await updateAlertSchedule(owner._id, { frequency: 'daily', isActive: true, deliveryTime: '09:00', weeklyDay: 'Monday' });
    await queueJobAlertsForJobs([await job()]);
    assert.equal(await JobAlertDelivery.countDocuments(), 1);
    await User.updateOne({ _id: owner._id }, { $set: { telegramAlertsAllowed: false } });
    await JobAlertDelivery.updateMany({}, { $set: { scheduledFor: new Date(0) } });
    await recoverQueuedJobAlerts();
    assert.equal(requests.length, 0);
  });

  await t.test('a payload rejection keeps alerts enabled and a later retry can succeed', async st => {
    await reset(); const owner = await user(); const listing = await job(); let reject = true;
    const requests = provider(st, () => reject
      ? { ok: false, error_code: 400, description: 'Bad Request: message is too long' }
      : { ok: true, result: { message_id: 124 } });
    await queueAndDeliverDueAlerts([listing]);
    assert.equal((await User.findById(owner._id)).premium.telegramAlertsEnabled, true, 'A malformed message is not an account opt-out.');
    const pending = await JobAlertDelivery.findOne({ user: owner._id });
    assert.equal(pending.status, 'queued'); assert.ok(pending.retryAt > new Date());
    reject = false;
    await JobAlertDelivery.updateOne({ _id: pending._id }, { $set: { retryAt: new Date(0) } });
    await recoverQueuedJobAlerts();
    assert.equal(requests.length, 2); assert.equal(await JobAlertDelivery.countDocuments(), 0);
  });

  await t.test('Telegram flood-control delay is honored without disabling alerts', async st => {
    await reset(); const owner = await user(); const listing = await job(); const before = Date.now();
    const requests = provider(st, () => ({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 180', parameters: { retry_after: 180 } }));
    await queueAndDeliverDueAlerts([listing]);
    const pending = await JobAlertDelivery.findOne({ user: owner._id });
    assert.ok(pending.retryAt.getTime() >= before + 180000, 'Recovery must not retry before Telegram permits it.');
    assert.equal((await User.findById(owner._id)).premium.telegramAlertsEnabled, true);
    await recoverQueuedJobAlerts(); assert.equal(requests.length, 1);
  });

  await t.test('an eligible linked admin does not need a paid subscription to receive alerts', async st => {
    await reset(); await user({ role: 'admin', premium: { planId: 'free', status: 'inactive', telegramAlertsEnabled: true } });
    const requests = provider(st);
    await queueAndDeliverDueAlerts([await job()]);
    assert.equal(requests.length, 1, 'Admin entitlement must match the settings API and delivery checks.');
  });

  for (const [status, description] of [[403, 'Forbidden: bot was blocked by the user'], [400, 'Bad Request: chat not found']]) {
    await t.test(`a confirmed unavailable chat (${status}) disables further delivery`, async st => {
      await reset(); const owner = await user(); const requests = provider(st, () => ({ ok: false, error_code: status, description }));
      await queueAndDeliverDueAlerts([await job()]);
      assert.equal((await User.findById(owner._id)).premium.telegramAlertsEnabled, false);
      assert.equal((await JobAlertDelivery.findOne()).reason, 'telegram_chat_unavailable');
      await recoverQueuedJobAlerts(); assert.equal(requests.length, 1);
    });
  }

  await t.test('paused and scheduled alerts wait, then recovery delivers due work', async st => {
    await reset(); const owner = await user(); const requests = provider(st);
    await updateAlertSchedule(owner._id, { frequency: 'daily', isActive: false, deliveryTime: '09:00', weeklyDay: 'Monday' });
    await queueJobAlertsForJobs([await job()]);
    await recoverQueuedJobAlerts(); assert.equal(requests.length, 0);
    await updateAlertSchedule(owner._id, { frequency: 'daily', isActive: true, deliveryTime: '09:00', weeklyDay: 'Monday' });
    await recoverQueuedJobAlerts(); assert.equal(requests.length, 0);
    await JobAlertDelivery.updateMany({}, { $set: { scheduledFor: new Date(0) } });
    await recoverQueuedJobAlerts(); assert.equal(requests.length, 1);
  });

  await t.test('recovery respects an account deactivated after its delivery was queued', async st => {
    await reset(); const owner = await user(); const requests = provider(st);
    await updateAlertSchedule(owner._id, { frequency: 'daily', isActive: true, deliveryTime: '09:00', weeklyDay: 'Monday' });
    await queueJobAlertsForJobs([await job()]);
    await User.updateOne({ _id: owner._id }, { $set: { deactivated: true } });
    await JobAlertDelivery.updateMany({}, { $set: { scheduledFor: new Date(0) } });
    await recoverQueuedJobAlerts(); assert.equal(requests.length, 0);
  });
});

test('bounded alert text preserves complete navigation links and valid Unicode', t => {
  const previousOrigin = process.env.FRONTEND_ORIGIN;
  process.env.FRONTEND_ORIGIN = 'https://jobs.example.test';
  t.after(() => { if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN; else process.env.FRONTEND_ORIGIN = previousOrigin; });
  const jobs = Array.from({ length: 5 }, (_,i) => ({ _id: `job-${i}`, title: 'Developer '.repeat(100), company: 'Example '.repeat(100),
    location: 'Bengaluru '.repeat(100), description: '\u{1F600}'.repeat(8000), sourceUrl: `https://employer.example.test/jobs/${i}?source=${'a'.repeat(8000)}` }));
  const body = buildTelegramMessageBody(jobs);
  assert.ok(body.length <= 4096);
  assert.equal(body.isWellFormed(), true);
  assert.ok(body.includes('https://jobs.example.test/jobs/job-0'), 'Long employer URLs need a complete JobVerify link.');
  assert.equal(body.includes('https://jobs.example.test/jobs/job-1'), false);
});
