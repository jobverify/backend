import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import { passwordSafety } from '../src/services/passwordSafety.js';
import { verifyEmail } from '../src/controllers/authController.js';

test('creating a verified account starts a cookie session for that account', async t => {
  process.env.FRONTEND_ORIGIN ||= 'http://127.0.0.1:5173';
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'verification-session-test-secret-123456789';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const pending = new PendingUser({ email: 'new.owner@gmail.com', profile: { name: 'New Owner' } });
  t.mock.method(PendingUser, 'findOne', async () => pending);
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(passwordSafety, 'check', async () => {});
  t.mock.method(User.db, 'transaction', async callback => callback({}));
  t.mock.method(PendingUser, 'findOneAndDelete', async () => pending);
  t.mock.method(User.prototype, 'save', async function () { return this; });
  const cookies = [];
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value, options) { cookies.push({ name, value, options }); return this; },
    clearCookie() { return this; } };
  await verifyEmail({ body: { token: 'mailbox-owner-token', password: 'NewOwnerPassword123!' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user?.email, 'new.owner@gmail.com');
  const session = cookies.find(cookie => cookie.options.httpOnly);
  assert.ok(session, 'verification must issue an HttpOnly session cookie');
  const claims = jwt.verify(session.value, process.env.JWT_SECRET);
  assert.equal(claims.id, String(res.body.user.id));
  assert.equal(claims.sessionVersion, 0);
  assert.equal(res.body.token, undefined);
});
