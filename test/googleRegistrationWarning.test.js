import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import { register } from '../src/controllers/authController.js';

for (const hasPassword of [false, true]) {
  test(`registration directs an existing Google account to sign in (password: ${hasPassword})`, async t => {
    t.mock.method(User, 'findOne', async () => ({
      google: { sub: 'existing-google-subject' }, password: hasPassword ? 'stored-hash' : null,
    }));
    const pendingLookup = t.mock.method(PendingUser, 'findOne', async () => {
      assert.fail('Existing Google accounts must not start pending registration');
    });
    const pendingSave = t.mock.method(PendingUser.prototype, 'save', async () => {
      assert.fail('Existing Google accounts must not create verification tokens');
    });
    const res = { statusCode: 200, body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await register({ body: { name: 'Existing User', email: 'existing@gmail.com' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.accountExists, true);
    assert.equal(res.body.pending, undefined);
    assert.equal(res.body.message,
      'This account was created with Google. Select \u201cContinue with Google\u201d to sign in.');
    assert.equal(pendingLookup.mock.callCount(), 0);
    assert.equal(pendingSave.mock.callCount(), 0);
  });
}

