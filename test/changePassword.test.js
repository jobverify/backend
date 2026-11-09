import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import * as controller from '../src/controllers/authController.js';
import * as validators from '../src/validation/requestValidators.js';

process.env.JWT_SECRET = 'password-change-tests-secret-at-least-32-characters';
const oldPassword = 'OldPassword123';
const newPassword = 'NewPassword456';
const response = () => ({
  statusCode: 200, body: null, cookies: [],
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie(name, value) { this.cookies.push([name, value]); return this; },
});
const request = (body = {}) => ({ user: { _id: 'user-id', sessionVersion: 2 }, body: { oldPassword, newPassword, confirmPassword: newPassword, ...body } });

async function invoke(req, res) {
  assert.equal(typeof controller.changePassword, 'function', 'Password change handler must exist');
  assert.ok(validators.changePasswordValidation, 'Password change validation must exist');
  for (const rule of validators.changePasswordValidation) await rule.run(req);
  return controller.changePassword(req, res);
}

test('password change verifies the old password, hashes the replacement, clears reset links and renews the session', async (t) => {
  const stored = { _id: 'user-id', role: 'user', password: await bcrypt.hash(oldPassword, 4), sessionVersion: 2 };
  t.mock.method(User, 'findById', async () => stored);
  let write;
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    assert.equal(filter.password, stored.password);
    assert.equal(filter.sessionVersion, 2);
    write = update;
    return { ...stored, ...update.$set, sessionVersion: 3 };
  });
  const res = response();
  await invoke(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(await bcrypt.compare(newPassword, write.$set.password), true);
  assert.equal(write.$set.resetPasswordTokenHash, null);
  assert.equal(write.$set.resetPasswordExpiresAt, null);
  assert.ok(write.$set.passwordChangedAt instanceof Date);
  assert.equal(write.$set.sessionVersion, 3);
  assert.equal(jwt.verify(res.cookies[0][1], process.env.JWT_SECRET).sessionVersion, 3);
  assert.equal(JSON.stringify(res.body).includes(newPassword), false);
});

for (const password of ['WrongPassword123', null]) {
  test(`password change rejects ${password ? 'incorrect old passwords' : 'accounts without a password'}`, async (t) => {
    t.mock.method(User, 'findById', async () => ({ password: password ? await bcrypt.hash(oldPassword, 4) : null, sessionVersion: 2 }));
    const write = t.mock.method(User, 'findOneAndUpdate', async () => assert.fail('Must not change password'));
    const res = response();
    await invoke(request({ oldPassword: password || oldPassword }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(write.mock.callCount(), 0);
    assert.equal(res.cookies.length, 0);
  });
}

for (const body of [{ confirmPassword: 'DifferentPassword123' }, { oldPassword: '' }, { newPassword: 'weak', confirmPassword: 'weak' }, { newPassword: 123 }, { confirmPassword: undefined }]) {
  test(`password change validates input ${JSON.stringify(body)}`, async (t) => {
    const read = t.mock.method(User, 'findById', async () => assert.fail('Invalid inputs must not reach the database'));
    const req = request(body);
    const res = response();
    await invoke(req, res);
    assert.equal(validationResult(req).isEmpty(), false);
    assert.equal(res.statusCode, 400);
    assert.equal(read.mock.callCount(), 0);
  });
}

test('password change refuses a concurrent credential change', async (t) => {
  t.mock.method(User, 'findById', async () => ({ password: await bcrypt.hash(oldPassword, 4), sessionVersion: 2 }));
  t.mock.method(User, 'findOneAndUpdate', async () => null);
  const res = response();
  await invoke(request(), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.cookies.length, 0);
});

test('password change accepts legacy accounts with a missing or null session version', async (t) => {
  const password = await bcrypt.hash(oldPassword, 4);
  t.mock.method(User, 'findById', async () => ({ _id: 'user-id', role: 'user', password, sessionVersion: 0 }));
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    // MongoDB $in with null matches both explicit null and an absent field.
    assert.deepEqual(filter.sessionVersion, { $in: [0, null] });
    assert.equal(update.$set.sessionVersion, 1);
    return { _id: 'user-id', role: 'user', sessionVersion: 1 };
  });
  const req = request();
  req.user.sessionVersion = 0;
  const res = response();
  await invoke(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(jwt.verify(res.cookies[0][1], process.env.JWT_SECRET).sessionVersion, 1);
});

test('password change route requires authentication', async () => {
  const { default: router } = await import('../src/routes/authRoutes.js');
  const route = router.stack.find(layer => layer.route?.path === '/change-password');
  assert.ok(route, 'Password change route must exist');
  assert.equal(route.route.stack[0].name, 'protect');
});

test('a password change revokes older sessions while the renewed session remains authorized', async (t) => {
  const { protect } = await import('../src/middleware/authMiddleware.js');
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'user-id', sessionVersion: 3 }) }));
  for (const sessionVersion of [2, 3]) {
    const token = jwt.sign({ id: 'user-id', sessionVersion }, process.env.JWT_SECRET);
    const res = response();
    let authorized = false;
    await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => { authorized = true; });
    assert.equal(authorized, sessionVersion === 3);
    assert.equal(res.statusCode, sessionVersion === 3 ? 200 : 401);
  }
});
