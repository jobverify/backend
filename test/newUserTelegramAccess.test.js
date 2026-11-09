import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import { authenticateWithGoogle, verifyEmail } from '../src/controllers/authController.js';
import { googleIdentity } from '../src/utils/googleAuth.js';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie() { return this; },
  clearCookie() { return this; },
});

for (const flow of ['email', 'google', 'google-pending']) {
  test(`${flow} signup saves new users with Telegram alerts disabled`, async t => {
    process.env.JWT_SECRET = 'new-user-telegram-test-secret-at-least-32-characters';
    const previousOrigin = process.env.FRONTEND_ORIGIN;
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    t.after(() => {
      if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
      else process.env.FRONTEND_ORIGIN = previousOrigin;
    });
    const pending = { email: 'new-member@gmail.com', password: 'hashed-password' };
    const saved = [];
    t.mock.method(User, 'findOne', async () => null);
    t.mock.method(PendingUser, 'findOne', async () => flow === 'google' ? null : pending);
    t.mock.method(PendingUser, 'deleteOne', async () => ({}));
    t.mock.method(PendingUser, 'findOneAndDelete', async () => pending);
    t.mock.method(User.db, 'transaction', async callback => callback({}));
    t.mock.method(User.prototype, 'save', async function () { saved.push(this.toObject()); return this; });
    t.mock.method(googleIdentity, 'verifyCredential', async () => ({
      email: pending.email, emailVerified: true, sub: 'google-subject', name: 'New Member',
    }));
    const res = response();
    if (flow === 'email') await verifyEmail({ body: { token: 'verification-token', password: 'MailboxOwnerPassword123!' } }, res);
    else await authenticateWithGoogle({ body: { credential: 'google-credential' } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(saved.length > 0);
    for (const user of saved) {
      assert.equal(user.telegramAlertsAllowed, false);
      assert.equal(user.premium.telegramAlertsEnabled, false);
    }
    if (flow !== 'email') assert.equal(res.body.user.access.telegramAlertsAllowed, false);
  });
}

for (const allowed of [true, false]) {
  test(`Google login preserves existing Telegram permission ${allowed}`, async t => {
    const user = User.hydrate({ email: 'existing@gmail.com', telegramAlertsAllowed: allowed });
    t.mock.method(User, 'findOne', async () => user);
    t.mock.method(user, 'save', async () => user);
    t.mock.method(googleIdentity, 'verifyCredential', async () => ({
      email: user.email, emailVerified: true, sub: 'existing-subject',
    }));
    const res = response();
    await authenticateWithGoogle({ body: { credential: 'google-credential' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(user.telegramAlertsAllowed, allowed);
    assert.equal(res.body.user.access.telegramAlertsAllowed, allowed);
  });
}
