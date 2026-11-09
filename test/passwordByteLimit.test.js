import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import { isStrongPassword } from '../src/utils/authSecurity.js';
import { registerValidation, verifyEmailValidation, resetPasswordValidation, changePasswordValidation, loginValidation } from '../src/validation/requestValidators.js';
import { login, changePassword } from '../src/controllers/authController.js';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';

const ascii72 = 'Aa1!' + 'x'.repeat(68);
const unicode72 = 'Aa1!' + 'é'.repeat(34);
const emoji72 = 'Aa1!' + '😀'.repeat(17);
const body = password => ({ name: 'Candidate', email: 'candidate@gmail.com', token: 'opaque-token', password,
  oldPassword: ascii72 + 'legacy-suffix', newPassword: password, confirmPassword: password });

async function errorsFor(rules, password) {
  const req = { body: body(password) };
  for (const rule of rules) await rule.run(req);
  return validationResult(req).array().filter(error => ['password', 'newPassword'].includes(error.path));
}

test('new password strength rejects UTF-8 inputs above bcrypt capacity without truncation', () => {
  for (const value of [ascii72, unicode72, emoji72]) {
    assert.equal(Buffer.byteLength(value), 72);
    assert.equal(isStrongPassword(value), true);
    assert.equal(isStrongPassword(value + 'x'), false);
  }
});

for (const [name, rules] of Object.entries({ registerValidation, verifyEmailValidation, resetPasswordValidation, changePasswordValidation })) {
  test(`${name} accepts 72-byte new passwords and rejects 73-byte ASCII or Unicode inputs`, async () => {
    for (const value of [ascii72, unicode72, emoji72]) {
      assert.deepEqual(await errorsFor(rules, value), []);
      const errors = await errorsFor(rules, value + 'x');
      assert.ok(errors.length > 0, 'Oversized new password must be rejected');
      assert.match(errors[0].msg, /72.*bytes/i);
    }
  });
}

test('verification requires a password while legacy login inputs retain bcrypt compatibility', async () => {
  assert.ok((await errorsFor(verifyEmailValidation, undefined)).length > 0);
  const legacy = ascii72 + 'existing-long-password';
  assert.deepEqual(await errorsFor(loginValidation, legacy), []);
  const hash = await bcrypt.hash(legacy, 4);
  assert.equal(await bcrypt.compare(legacy, hash), true);
  const req = { body: body('NewPassword123!') };
  for (const rule of changePasswordValidation) await rule.run(req);
  assert.equal(validationResult(req).array().some(error => error.path === 'oldPassword'), false);
});

test('the real login and replacement handlers accept an existing long password', async t => {
  const jwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'legacy-password-compatibility-fixture-secret';
  t.after(() => { if (jwtSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = jwtSecret; });
  const legacy = ascii72 + 'existing-long-password';
  const account = { _id: 'existing-user', email: 'candidate@gmail.com', role: 'user', sessionVersion: 0,
    password: await bcrypt.hash(legacy, 4), save: async () => {} };
  t.mock.method(User, 'findOne', async () => account);
  t.mock.method(PendingUser, 'findOne', async () => assert.fail('Existing user must retain login'));
  t.mock.method(User, 'findById', async () => account);
  t.mock.method(User, 'findOneAndUpdate', async (_filter, update) => ({ ...account, ...update.$set }));
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }, cookie() {} });
  const loginReq = { body: { email: account.email, password: legacy } };
  for (const rule of loginValidation) await rule.run(loginReq);
  const signedIn = response();
  await login(loginReq, signedIn);
  assert.equal(signedIn.statusCode, 200);
  assert.equal(signedIn.body.success, true);
  const replacement = 'ReplacementPassword123!';
  const req = { user: account, body: { oldPassword: legacy, newPassword: replacement, confirmPassword: replacement } };
  for (const rule of changePasswordValidation) await rule.run(req);
  const changed = response();
  await changePassword(req, changed);
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.body.success, true);
});
