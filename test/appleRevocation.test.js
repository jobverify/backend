import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';

test('Apple deletion retains only a bounded encrypted revocation task during provider failure', { timeout: 90000 }, async t => {
  const { queueAppleRevocation, retryAppleRevocations } = await import('../src/services/appleTokenRevocation.js');
  const { default: Queue } = await import('../src/models/AppleTokenRevocation.js');
  const { appleIdentity, encryptAppleRefreshToken } = await import('../src/utils/appleAuth.js');
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  }, instance: { launchTimeout: 60000 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Queue.init()]);
  const key = randomBytes(32).toString('base64');
  const token = encryptAppleRefreshToken('private-refresh-token', key);
  const user = await User.create({ email: 'hidden@privaterelay.appleid.com', isVerified: true,
    apple: { sub: 'deleting-subject', clientId: 'in.jobverify.web', refreshToken: token } });
  let providerDown = true;
  t.mock.method(appleIdentity, 'revokeEncryptedToken', async (value, clientId) => {
    assert.equal(value, token); assert.equal(clientId, 'in.jobverify.web');
    if (providerDown) throw new Error('provider unavailable');
  });
  await queueAppleRevocation(await User.findById(user._id));
  await queueAppleRevocation(await User.findById(user._id));
  assert.equal(await Queue.countDocuments(), 1, 'Retries do not duplicate the same deletion token');
  const queued = await Queue.findOne().select('+encryptedToken').lean();
  assert.equal(queued.encryptedToken, token);
  assert.ok(queued.expiresAt > new Date());
  assert.ok(queued.expiresAt.getTime() <= Date.now() + 31 * 86400000);
  assert.equal(queued.user, undefined); assert.equal(queued.email, undefined); assert.equal(queued.sub, undefined);
  assert.equal((await Queue.findOne().lean()).encryptedToken, undefined);
  await User.deleteOne({ _id: user._id });
  providerDown = false;
  assert.deepEqual(await retryAppleRevocations({ limit: 10 }), { attempted: 1, revoked: 1, failed: 0 });
  assert.equal(await Queue.countDocuments(), 0);
});

test('Apple revoke endpoint receives a decrypted token and a fresh server-only client secret', async t => {
  const { appleIdentity, encryptAppleRefreshToken } = await import('../src/utils/appleAuth.js');
  const signing = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const key = randomBytes(32).toString('base64');
  const env = { APPLE_AUTH_ENABLED: 'true', APPLE_CLIENT_ID: 'in.jobverify.web', APPLE_TEAM_ID: 'TESTTEAM12', APPLE_KEY_ID: 'TESTKEY123',
    APPLE_PRIVATE_KEY: signing.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    APPLE_REDIRECT_URI: 'https://www.example.com/login', APPLE_TOKEN_ENCRYPTION_KEY: key };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://appleid.apple.com/auth/revoke');
    const params = new URLSearchParams(options.body);
    assert.equal(params.get('token'), 'private-refresh-token');
    assert.equal(params.get('token_type_hint'), 'refresh_token');
    assert.ok(params.get('client_secret')); return new Response('', { status: 200 });
  });
  await appleIdentity.revokeEncryptedToken(encryptAppleRefreshToken('private-refresh-token', key), 'in.jobverify.web', env);
});
