import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import SiteSettings from '../src/models/SiteSettings.js';
import TelegramLinkToken from '../src/models/TelegramLinkToken.js';
import Subscription from '../src/models/Subscription.js';

process.env.JWT_SECRET = 'telegram-free-mode-test-secret-at-least-32-characters';
const { default: userRoutes } = await import('../src/routes/userRoutes.js');

test('Telegram routes support linking, settings and schedules for free members only in free site mode', async t => {
  const user = new User({
    email: 'telegram-free@example.test', password: 'hashed-password',
    telegram: { chatId: '123', linkedAt: new Date() },
    profile: { telegramAlertFilters: { company: ['Example'] } },
  });
  let billingEnabled = false;
  t.mock.method(SiteSettings, 'findById', () => ({ lean: async () => ({ billingEnabled }) }));
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  t.mock.method(User, 'findById', () => Object.assign(Promise.resolve(user), { select: async () => user }));
  t.mock.method(user, 'save', async () => user);
  t.mock.method(TelegramLinkToken, 'create', async () => ({}));
  t.mock.method(TelegramLinkToken, 'updateMany', async () => ({}));
  t.mock.method(Subscription, 'findOne', () => ({ lean: () => ({ exec: async () => null }) }));
  const previousBot = process.env.TELEGRAM_BOT_USERNAME;
  process.env.TELEGRAM_BOT_USERNAME = 'fixture_bot';
  t.after(() => {
    if (previousBot === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
    else process.env.TELEGRAM_BOT_USERNAME = previousBot;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/user', userRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (path, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}/api/user/telegram-alerts${path}`, {
    method, headers: { authorization: `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const link = await request('/link', 'POST');
  assert.equal(link.status, 200);
  assert.match((await link.json()).data.deepLink, /^https:\/\/t.me\/fixture_bot\?start=/);
  const enabled = await request('', 'PUT', { enabled: true });
  assert.equal(enabled.status, 200);
  assert.equal((await enabled.json()).data.canUseTelegramAlerts, true);
  assert.equal((await (await request('')).json()).data.canUseTelegramAlerts, true);
  assert.equal((await request('/schedule')).status, 200);
  const template = '{title} at {company}\n{jobUrl}';
  const savedTemplate = await request('', 'PUT', { template });
  assert.equal(savedTemplate.status, 200);
  assert.equal((await savedTemplate.json()).data.template, template);
  assert.equal((await (await request('')).json()).data.template, template);
  assert.equal((await request('', 'PUT', { template: '{unknown}\n{jobUrl}' })).status, 400);
  const preview = await request('/preview', 'POST', { template, sample: 'minimal' });
  assert.equal(preview.status, 200);
  assert.match((await preview.json()).data.text, /Software Engineer at Example Company/);
  assert.equal((await request('/preview', 'POST', { template, sample: 'unknown' })).status, 400);
  billingEnabled = true;
  assert.equal((await request('/link', 'POST')).status, 403);
  assert.equal((await request('', 'PUT', { enabled: true })).status, 403);
  assert.equal((await request('/schedule')).status, 409);
});
