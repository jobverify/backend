import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import SiteSettings from '../src/models/SiteSettings.js';
import AdminAudit from '../src/models/AdminAudit.js';
import { buildAccessSummary, canUseTelegramAlerts } from '../src/utils/accessControl.js';

process.env.JWT_SECRET = 'telegram-admin-access-test-secret-at-least-32-characters';
const { default: userRoutes } = await import('../src/routes/userRoutes.js');
const { default: adminRoutes } = await import('../src/routes/adminRoutes.js');

test('admin-disabled Telegram access overrides free mode, premium plans, and admin role', () => {
  for (const role of ['user', 'admin']) {
    const user = {
      role, telegramAlertsAllowed: false,
      accessRole: 'yearly_premium_user',
      premium: { planId: 'yearly', status: 'active', telegramAlertsEnabled: true },
      telegram: { chatId: '123', linkedAt: new Date() },
    };
    for (const billingEnabled of [false, true]) {
      assert.equal(canUseTelegramAlerts(user, new Date(), { billingEnabled }), false);
    }
    assert.equal(buildAccessSummary(user).telegramAlertsAllowed, false);
    assert.equal(buildAccessSummary(user).hasTelegramAlerts, false);
  }
});

test('admin can change Telegram access; disabled users cannot use any Telegram endpoint', async t => {
  const admin = new User({ email: 'admin@example.test', role: 'admin' });
  const member = new User({ email: 'member@example.test', telegram: { chatId: '123', linkedAt: new Date() } });
  t.mock.method(SiteSettings, 'findById', () => ({ lean: async () => ({ billingEnabled: false }) }));
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  t.mock.method(User, 'findById', id => {
    const user = String(id) === String(admin._id) ? admin : member;
    return Object.assign(Promise.resolve(user), { select: async () => user });
  });
  t.mock.method(User, 'findOneAndUpdate', async (_filter, update) => {
    Object.assign(member, update.$set);
    return member;
  });
  t.mock.method(AdminAudit, 'create', async () => ({}));
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/user', userRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (user, path, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { authorization: `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const adminPath = `/api/admin/users/${member._id}/telegram-access`;
  assert.equal((await request(member, adminPath, 'PUT', { enabled: false })).status, 403);
  for (const enabled of ['false', 0, null]) {
    assert.equal((await request(admin, adminPath, 'PUT', { enabled })).status, 400);
  }
  const disabled = await request(admin, adminPath, 'PUT', { enabled: false });
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json()).data.telegramAlertsAllowed, false);
  for (const [path, method, body] of [
    ['', 'GET'], ['', 'PUT', { enabled: true }], ['', 'PUT', { telegramAlertFilters: { company: ['Example'] } }],
    ['', 'DELETE'], ['/link', 'POST'], ['/schedule', 'GET'], ['/schedule', 'PUT', {}],
  ]) {
    assert.equal((await request(member, `/api/user/telegram-alerts${path}`, method, body)).status, 403, `${method} ${path}`);
  }
  const enabled = await request(admin, adminPath, 'PUT', { enabled: true });
  assert.equal(enabled.status, 200);
  assert.equal((await enabled.json()).data.telegramAlertsAllowed, true);
  assert.equal((await request(member, '/api/user/telegram-alerts')).status, 200);
});
