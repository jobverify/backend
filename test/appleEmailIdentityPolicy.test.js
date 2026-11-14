import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import Challenge from '../src/models/AppleAuthChallenge.js';
import { authenticateWithApple } from '../src/controllers/appleAuthController.js';
import { appleIdentity, hashAppleChallenge, verifyAppleIdentityToken } from '../src/utils/appleAuth.js';

const response = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
  cookie() { return this; }, clearCookie() { return this; },
});

test('Apple account creation checks the original signed email while existing subjects keep access', async t => {
  const signing = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const issuer = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...issuer.publicKey.export({ format: 'jwk' }), kid: 'identity-policy-fixture', alg: 'RS256', use: 'sig' };
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'apple-identity-policy-fixture-at-least-32-characters',
    APPLE_AUTH_ENABLED: 'true', APPLE_CLIENT_ID: 'in.jobverify.web', APPLE_TEAM_ID: 'TESTTEAM12', APPLE_KEY_ID: 'TESTKEY123',
    APPLE_PRIVATE_KEY: signing.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    APPLE_REDIRECT_URI: 'https://www.example.com/login', APPLE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') });
  const state = 's'.repeat(43); const browser = 'b'.repeat(43); const nonce = 'identity-policy-fixture-nonce';
  const options = { clientId: process.env.APPLE_CLIENT_ID, nonceHash: hashAppleChallenge(nonce), keys: [jwk] };
  const token = email => jwt.sign({ sub: 'policy-subject', email, email_verified: true, nonce }, issuer.privateKey,
    { algorithm: 'RS256', keyid: jwk.kid, issuer: 'https://appleid.apple.com', audience: options.clientId, expiresIn: '5m' });
  let signedEmail; let existing = null; const saved = [];
  t.mock.method(Challenge, 'findOneAndDelete', async () => ({ nonceHash: options.nonceHash }));
  t.mock.method(User, 'findOne', filter => {
    assert.deepEqual(filter, { 'apple.sub': 'policy-subject' });
    return { select: async () => existing };
  });
  t.mock.method(User, 'exists', async () => null);
  t.mock.method(User.prototype, 'save', async function () { saved.push(this.email); return this; });
  t.mock.method(PendingUser, 'deleteOne', async () => ({ deletedCount: 0 }));
  t.mock.method(appleIdentity, 'verifyResponse', async () => ({
    ...await verifyAppleIdentityToken(token(signedEmail), options), refreshToken: 'fixture-refresh-token',
  }));
  const signIn = async email => {
    signedEmail = email;
    const res = response();
    await authenticateWithApple({ headers: { cookie: `jobverify_apple_challenge=${browser}` },
      body: { dateOfBirth: '2000-01-15', state, idToken: 'fixture-signed-token', code: 'fixture-code' } }, res);
    return res;
  };
  await t.test('new identities reject composed, decomposed, and ASCII-folding Unicode', async () => {
    for (const email of ['\u00e9.apple@icloud.com', 'e\u0301.apple@icloud.com', '\u212Aate@icloud.com']) {
      assert.equal((await signIn(email)).statusCode, 400, email);
    }
    assert.equal(saved.length, 0);
  });
  await t.test('ASCII and private relay identities retain normalization and account creation', async () => {
    for (const email of [' New.Apple@iCloud.com ', 'hidden@privaterelay.appleid.com']) {
      const res = await signIn(email);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.user.email, email.trim().toLowerCase());
    }
  });
  await t.test('an existing Unicode account is still authenticated by its bound subject', async () => {
    existing = new User({ email: '\u00e9.existing@icloud.com', isVerified: true, apple: { sub: 'policy-subject' } });
    existing.isNew = false;
    const res = await signIn('\u00e9.existing@icloud.com');
    assert.equal(res.statusCode, 200);
    assert.equal(String(res.body.user.id), String(existing._id));
    assert.equal(res.body.user.email, '\u00e9.existing@icloud.com');
  });
});
