import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { login } from "../src/controllers/authController.js";
import User from "../src/models/User.js";
import PendingUser from "../src/models/PendingUser.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; },
  cookie() { assert.fail("An unsuccessful sign-in must not create a session."); },
});

test("invalid login responses do not disclose whether an email is registered", async (t) => {
  const passwordHash = await bcrypt.hash("CorrectPassword123", 4);
  const accounts = new Map([
    ["google.account@gmail.com", { password: null, google: { sub: "google-subject" } }],
    ["password.account@gmail.com", { password: passwordHash }],
    ["deactivated.account@gmail.com", { password: passwordHash, deactivated: true }],
  ]);
  t.mock.method(User, "findOne", async ({ email }) => accounts.get(email) ?? null);
  t.mock.method(PendingUser, "findOne", async () => null);

  for (const email of ["unknown.account@gmail.com", ...accounts.keys()]) {
    const res = createResponse();
    await login({ body: { email, password: "IncorrectPassword123" } }, res);

    assert.equal(res.statusCode, 401, email);
    assert.deepEqual(res.body, {
      code: 401,
      success: false,
      message: "Incorrect email or password. Please try again or reset your password.",
    }, email);
  }
});

test('pending accounts without a password receive the same generic credential failure', async t => {
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(PendingUser, 'findOne', async () => ({ password: null }));
  const res = createResponse();
  await login({ body: { email: 'pending@gmail.com', password: 'WrongPassword123!' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Incorrect email or password. Please try again or reset your password.');
});

test('a deactivated account is explained only after proving its password', async t => {
  t.mock.method(User, 'findOne', async () => ({ password: await bcrypt.hash('CorrectPassword123', 4), deactivated: true }));
  const res = createResponse();
  await login({ body: { email: 'deactivated@gmail.com', password: 'CorrectPassword123' } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /deactivated/);
});

test('failed login categories each perform one policy-cost password comparison', async t => {
  const accounts = new Map([
    ['google.account@gmail.com', { password: null, google: { sub: 'fixture-subject' } }],
    ['password.account@gmail.com', { password: await bcrypt.hash('FixturePassword123!', 10) }],
  ]);
  t.mock.method(User, 'findOne', async ({ email }) => accounts.get(email) ?? null);
  t.mock.method(PendingUser, 'findOne', async () => null);
  const compare = t.mock.method(bcrypt, 'compare', async (_password, hash) => {
    assert.equal(bcrypt.getRounds(hash), 10);
    return false;
  });
  for (const email of ['unknown.account@gmail.com', ...accounts.keys()]) {
    const previous = compare.mock.callCount();
    const res = createResponse();
    await login({ body: { email, password: 'IncorrectPassword123!' } }, res);
    assert.equal(compare.mock.callCount() - previous, 1, email);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Incorrect email or password. Please try again or reset your password.');
  }
});

test('pending registrations never receive the account-does-not-exist warning', async t => {
  const password = 'PendingPassword123!';
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(PendingUser, 'findOne', async () => ({ password: await bcrypt.hash(password, 4) }));
  for (const [submittedPassword, expectedMessage] of [
    [password, 'Your email verification is pending. Please verify your email to log in.'],
    ['WrongPassword123!', 'Incorrect email or password. Please try again or reset your password.'],
  ]) {
    const res = createResponse();
    await login({ body: { email: 'pending@gmail.com', password: submittedPassword } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, expectedMessage);
  }
});


test('a valid password still creates a private versioned session', async t => {
  const user = new User({ email: 'valid.account@gmail.com',
    password: await bcrypt.hash('CorrectPassword123', 4), sessionVersion: 3, isVerified: true });
  user.isNew = false;
  t.mock.method(User, 'findOne', async () => user);
  t.mock.method(user, 'save', async () => user);
  const res = createResponse();
  let cookie;
  res.cookie = (name, token, options) => { cookie = { name, token, options }; return res; };
  await login({ body: { email: 'valid.account@gmail.com', password: 'CorrectPassword123' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.email, 'valid.account@gmail.com');
  assert.equal(res.body.user.password, undefined);
  assert.equal(cookie.options.httpOnly, true);
  const session = jwt.verify(cookie.token, process.env.JWT_SECRET);
  assert.equal(session.id, String(user._id));
  assert.equal(session.sessionVersion, 3);
});
