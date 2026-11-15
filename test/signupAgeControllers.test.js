import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import Challenge from '../src/models/AppleAuthChallenge.js';
import { register, resendVerification, authenticateWithGoogle, verifyEmail } from '../src/controllers/authController.js';
import { authenticateWithApple } from '../src/controllers/appleAuthController.js';
import { googleIdentity } from '../src/utils/googleAuth.js';
import { appleIdentity } from '../src/utils/appleAuth.js';

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }, cookie() { return this; }, clearCookie() { return this; },
});
const adult = '2000-01-15';
const tooYoung = '2020-01-15';

function setup(t) {
  const names = ['JWT_SECRET', 'FRONTEND_ORIGIN', 'EMAIL_RELAY_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { JWT_SECRET: randomBytes(32).toString('hex'),
    FRONTEND_ORIGIN: 'http://127.0.0.1:5173', EMAIL_RELAY_URL: '', SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1025', SMTP_USER: 'fixture', SMTP_PASS: 'fixture', SMTP_FROM: 'fixture@example.com' });
  t.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } });
  const pending = [], saved = [], mail = [];
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(User, 'exists', async () => null);
  t.mock.method(PendingUser, 'findOne', async () => null);
  t.mock.method(PendingUser, 'deleteOne', async () => ({ deletedCount: 0 }));
  t.mock.method(PendingUser.prototype, 'save', async function () { pending.push(this.toObject()); return this; });
  t.mock.method(User.prototype, 'save', async function () { saved.push(this.toObject()); return this; });
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async message => { mail.push(message); return { messageId: 'offline-fixture' }; } }));
  return { pending, saved, mail };
}

for (const [birthDate, expected] of [[undefined, 428], [tooYoung, 422], ['2024-02-30', 400], ['2999-01-01', 400]]) {
  test(`email signup rejects ${birthDate ?? 'missing age evidence'} before storing personal data or mailing`, async t => {
    const state = setup(t), res = response();
    await register({ body: { name: 'Age Fixture', email: 'age.fixture@gmail.com', dateOfBirth: birthDate } }, res);
    assert.equal(res.statusCode, expected);
    assert.deepEqual(state.pending, []);
    assert.deepEqual(state.saved, []);
    assert.deepEqual(state.mail, []);
  });
}

test('adult email signup retains the eligibility decision but never the birth date', async t => {
  const state = setup(t), res = response();
  await register({ body: { name: 'Age Fixture', email: 'age.fixture@gmail.com', dateOfBirth: adult } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(state.pending[0].ageEligibility.minimumAge, 18);
  assert.equal(state.pending[0].ageEligibility.policyVersion, '2026-11-14');
  assert.ok(state.pending[0].ageEligibility.checkedAt instanceof Date);
  assert.equal(JSON.stringify(state.pending).includes(adult), false);
});

for (const action of [register, resendVerification]) test(`${action.name} verification links preserve a local job return path`, async t => {
  const state = setup(t);
  if (action === resendVerification) t.mock.method(PendingUser, 'findOneAndUpdate', async () => ({}));
  const next = '/jobs/665f47f5f65f3f4d2e1d1001/frontend-engineer-example-corp?from=search';
  await action({ body: { name: 'Apply Fixture', email: 'apply.fixture@gmail.com', dateOfBirth: adult, next } }, response());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.mail.length, 1);
  const link = new URL(state.mail[0].html.match(/href="([^"]+)"/)[1]);
  assert.equal(link.origin, process.env.FRONTEND_ORIGIN);
  assert.equal(link.pathname, '/verify-email');
  assert.equal(link.searchParams.get('next'), next);
  assert.ok(new URLSearchParams(link.hash.slice(1)).get('token'));
});

test('verification links never adopt an external return origin', async t => {
  const state = setup(t);
  for (const next of ['https://untrusted.example/path', '//untrusted.example/path', '/\\untrusted.example/path', 'x'.repeat(5000)]) {
    await register({ body: { name: 'Apply Fixture', email: 'apply.fixture@gmail.com', dateOfBirth: adult, next } }, response());
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.mail.length, 4);
  for (const message of state.mail) {
    const link = new URL(message.html.match(/href="([^"]+)"/)[1]);
    assert.equal(link.origin, process.env.FRONTEND_ORIGIN);
    assert.equal(link.searchParams.get('next'), null);
  }
});

for (const [dateOfBirth, expected] of [[undefined, 428], [tooYoung, 422], [adult, 200]]) {
  test(`new Google account requires adult eligibility (${expected})`, async t => {
    const state = setup(t), res = response();
    t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email: 'google.age@gmail.com', emailVerified: true, sub: 'age-subject', name: 'Age Fixture' }));
    await authenticateWithGoogle({ body: { credential: 'offline-fixture', dateOfBirth } }, res);
    assert.equal(res.statusCode, expected);
    if (expected === 200) assert.equal(state.saved[0].ageEligibility.minimumAge, 18);
    else assert.deepEqual(state.saved, []);
    assert.equal(JSON.stringify(state.saved).includes(adult), false);
  });
}

test('an existing Google account can sign in without supplying a birth date', async t => {
  setup(t);
  const existing = new User({ email: 'returning@gmail.com', google: { sub: 'returning-subject' }, isVerified: true });
  existing.isNew = false;
  t.mock.method(User, 'findOne', async () => existing);
  t.mock.method(googleIdentity, 'verifyCredential', async () => ({ email: existing.email, emailVerified: true, sub: existing.google.sub }));
  const res = response();
  await authenticateWithGoogle({ body: { credential: 'offline-fixture' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(existing.ageEligibility, undefined);
});

test('legacy pending verification needs a fresh age check before creating an account', async t => {
  const state = setup(t), res = response();
  t.mock.method(PendingUser, 'findOne', async () => new PendingUser({ email: 'pending.age@gmail.com',
    profile: { name: 'Age Fixture' }, verificationTokenHash: 'fixture', verificationTokenExpiresAt: new Date(Date.now() + 60_000) }));
  await verifyEmail({ body: { token: 'fixture', password: 'AgeFixturePassword123!' } }, res);
  assert.equal(res.statusCode, 428);
  assert.deepEqual(state.saved, []);
});

test('Apple account creation applies the same gate while returning users keep access', async t => {
  const state = setup(t);
  const signing = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const values = { APPLE_AUTH_ENABLED: 'true', APPLE_CLIENT_ID: 'in.jobverify.web', APPLE_TEAM_ID: 'TESTTEAM12',
    APPLE_KEY_ID: 'TESTKEY123', APPLE_PRIVATE_KEY: signing.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    APPLE_REDIRECT_URI: 'https://www.example.com/login', APPLE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64') };
  const previous = Object.fromEntries(Object.keys(values).map(name => [name, process.env[name]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [name, value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  t.mock.method(Challenge, 'findOneAndDelete', async () => ({ nonceHash: 'fixture' }));
  t.mock.method(appleIdentity, 'verifyResponse', async () => ({ sub: 'apple-age-subject', email: 'age@icloud.com', emailVerified: true, refreshToken: 'offline-fixture' }));
  let existing = null;
  t.mock.method(User, 'findOne', () => ({ select: async () => existing }));
  for (const [dateOfBirth, expected] of [[undefined, 428], [tooYoung, 422], [adult, 200]]) {
    const res = response();
    await authenticateWithApple({ headers: { cookie: `jobverify_apple_challenge=${'b'.repeat(43)}` },
      body: { state: 's'.repeat(43), idToken: 'offline-token', code: 'offline-code', dateOfBirth } }, res);
    assert.equal(res.statusCode, expected);
  }
  assert.equal(state.saved[0].ageEligibility.minimumAge, 18);
  existing = new User({ email: 'age@icloud.com', apple: { sub: 'apple-age-subject' }, isVerified: true });
  existing.isNew = false;
  const res = response();
  await authenticateWithApple({ headers: { cookie: `jobverify_apple_challenge=${'b'.repeat(43)}` },
    body: { state: 's'.repeat(43), idToken: 'offline-token', code: 'offline-code' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(existing.ageEligibility, undefined);
});
