import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';

process.env.NODE_ENV = 'test';
process.env.ENABLE_RATE_LIMITING = 'true';
process.env.JWT_SECRET = 'account-limit-fixture-secret-at-least-32-characters';
const { default: router } = await import('../src/routes/authRoutes.js');

test('password login shares a normalized account budget across client IPs', { timeout: 30_000 }, async t => {
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(PendingUser, 'findOne', async () => null);
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/auth', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/auth/login`;
  let client = 0;
  const attempt = async (email, password = 'WrongPassword123!') => {
    const res = await fetch(url, { method: 'POST', headers: {
      'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${++client}`,
    }, body: JSON.stringify({ email, password }) });
    await res.json();
    return res;
  };
  for (let index = 0; index < 10; index++) {
    assert.equal((await attempt(index % 2 ? ' Account.Limit@gmail.com ' : 'account.limit@gmail.com')).status, 401);
  }
  const blocked = await attempt('ACCOUNT.LIMIT@GMAIL.COM');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal(blocked.headers.get('cache-control'), 'no-store');
  assert.equal((await attempt('different.account@gmail.com')).status, 401);
  for (let index = 0; index < 11; index++) {
    assert.equal((await attempt('validation-only@gmail.com', '')).status, 400);
  }
  assert.equal((await attempt('validation-only@gmail.com')).status, 401);
});


test('successful password logins do not exhaust the account failure budget', { timeout: 30_000 }, async t => {
  const password = 'SuccessfulLoginFixture123!';
  const user = new User({ email: 'success-budget@gmail.com', password: await bcrypt.hash(password, 4), isVerified: true });
  user.isNew = false;
  t.mock.method(User, 'findOne', async () => user);
  t.mock.method(User.prototype, 'save', async function () { return this; });
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/auth', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  let client = 0;
  const attempt = async candidate => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/auth/login`, { method: 'POST', headers: {
      'content-type': 'application/json', 'x-forwarded-for': `198.51.101.${++client}`,
    }, body: JSON.stringify({ email: 'success-budget@gmail.com', password: candidate }) });
    await res.json();
    return res.status;
  };
  for (let index = 0; index < 11; index++) assert.equal(await attempt(password), 200);
  for (let index = 0; index < 10; index++) assert.equal(await attempt('WrongPassword123!'), 401);
  assert.equal(await attempt('WrongPassword123!'), 429);
});
