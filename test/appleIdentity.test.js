import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const signing = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const publicKey = { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
const env = {
  APPLE_AUTH_ENABLED: 'true', APPLE_CLIENT_ID: 'in.jobverify.web',
  APPLE_TEAM_ID: 'TESTTEAM12', APPLE_KEY_ID: 'TESTKEY123',
  APPLE_PRIVATE_KEY: signing.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  APPLE_REDIRECT_URI: 'https://www.example.com/login',
  APPLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};
const now = Math.floor(Date.now() / 1000);
const claims = { iss: 'https://appleid.apple.com', aud: 'in.jobverify.web', sub: 'apple-subject',
  email: 'hidden@privaterelay.appleid.com', email_verified: 'true', is_private_email: 'true',
  nonce: 'fresh-nonce', iat: now, exp: now + 300 };
const token = (patch = {}, options = {}) => jwt.sign({ ...claims, ...patch }, rsa.privateKey,
  { algorithm: 'RS256', keyid: 'test-key', ...options });

test('Apple configuration stays disabled unless every signing and encryption setting is valid', async () => {
  const { readAppleConfig } = await import('../src/utils/appleAuth.js');
  assert.equal(readAppleConfig({}), null);
  for (const key of Object.keys(env)) assert.equal(readAppleConfig({ ...env, [key]: '' }), null, key);
  for (const patch of [{ APPLE_REDIRECT_URI: 'http://localhost:5173/login' }, { APPLE_TOKEN_ENCRYPTION_KEY: 'short' },
    { APPLE_PRIVATE_KEY: 'not-a-key' }, { APPLE_AUTH_ENABLED: 'false' }]) {
    assert.equal(readAppleConfig({ ...env, ...patch }), null);
  }
  assert.equal(readAppleConfig(env).clientId, 'in.jobverify.web');
});

test('Apple identity verification accepts signed relay email and rejects tampering, replay claims and unverified mail', async () => {
  const { verifyAppleIdentityToken, hashAppleChallenge } = await import('../src/utils/appleAuth.js');
  const options = { clientId: 'in.jobverify.web', nonceHash: hashAppleChallenge('fresh-nonce'), keys: [publicKey] };
  const identity = await verifyAppleIdentityToken(token(), options);
  assert.deepEqual(identity, { sub: 'apple-subject', email: 'hidden@privaterelay.appleid.com', emailVerified: true, emailIsAscii: true, privateEmail: true });
  for (const patch of [{ iss: 'https://attacker.example' }, { aud: 'other.client' }, { nonce: 'old-nonce' },
    { exp: now - 100 }, { iat: now + 500 }, { email_verified: 'false' }, { sub: '' }, { email: 'invalid' }]) {
    await assert.rejects(() => verifyAppleIdentityToken(token(patch), options));
  }
  const [header, payload, signature] = token().split('.');
  const forged = `${header}.${Buffer.from(JSON.stringify({ ...claims, sub: 'victim' })).toString('base64url')}.${signature}`;
  await assert.rejects(() => verifyAppleIdentityToken(forged, options));
  await assert.rejects(() => verifyAppleIdentityToken(jwt.sign(claims, 'attacker', { algorithm: 'HS256', keyid: 'test-key' }), options));
  await assert.rejects(() => verifyAppleIdentityToken(token(), { ...options, keys: [] }));
  assert.equal((await verifyAppleIdentityToken(token({ email_verified: true, is_private_email: true }), options)).privateEmail, true);
});

test('Apple names are bounded plain text and refresh tokens use authenticated encryption', async () => {
  const { sanitizeAppleName, encryptAppleRefreshToken, decryptAppleRefreshToken } = await import('../src/utils/appleAuth.js');
  assert.equal(sanitizeAppleName({ firstName: '  Anu ', lastName: ' Rao  ' }), 'Anu Rao');
  assert.equal(sanitizeAppleName({ firstName: '<script>alert(1)</script>', lastName: 'Rao' }), 'Rao');
  assert.equal(sanitizeAppleName({ firstName: 'A'.repeat(100) }).length, 80);
  assert.equal(sanitizeAppleName({ firstName: { value: 'bad' } }), '');
  const encrypted = encryptAppleRefreshToken('private-refresh-token', env.APPLE_TOKEN_ENCRYPTION_KEY);
  assert.ok(!encrypted.includes('private-refresh-token'));
  assert.notEqual(encrypted, encryptAppleRefreshToken('private-refresh-token', env.APPLE_TOKEN_ENCRYPTION_KEY));
  assert.equal(decryptAppleRefreshToken(encrypted, env.APPLE_TOKEN_ENCRYPTION_KEY), 'private-refresh-token');
  await assert.rejects(async () => decryptAppleRefreshToken(encrypted, randomBytes(32).toString('base64')));
  await assert.rejects(async () => decryptAppleRefreshToken(`${encrypted.slice(0, -5)}AAAAA`, env.APPLE_TOKEN_ENCRYPTION_KEY));
});

test('Apple web credentials are exchanged and the server token is independently checked before use', async t => {
  const { appleIdentity, hashAppleChallenge } = await import('../src/utils/appleAuth.js');
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    requests.push(String(url));
    if (String(url).endsWith('/auth/keys')) return Response.json({ keys: [publicKey] });
    assert.equal(String(url), 'https://appleid.apple.com/auth/token');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('code'), 'fresh-code');
    assert.equal(body.get('redirect_uri'), 'https://www.example.com/login');
    const secret = jwt.verify(body.get('client_secret'), signing.publicKey, { algorithms: ['ES256'],
      issuer: 'TESTTEAM12', subject: 'in.jobverify.web', audience: 'https://appleid.apple.com' });
    assert.ok(secret.exp - secret.iat <= 600);
    return Response.json({ id_token: token(), refresh_token: 'private-refresh-token', access_token: 'private-access-token', token_type: 'Bearer', expires_in: 3600 });
  });
  const result = await appleIdentity.verifyResponse({ idToken: token(), code: 'fresh-code', nonceHash: hashAppleChallenge('fresh-nonce') }, env);
  assert.equal(result.sub, 'apple-subject');
  assert.equal(result.refreshToken, 'private-refresh-token');
  assert.ok(requests.includes('https://appleid.apple.com/auth/token'));
  t.mock.method(globalThis, 'fetch', async url => String(url).endsWith('/auth/keys')
    ? Response.json({ keys: [publicKey] }) : Response.json({ id_token: token({ sub: 'other-account' }), refresh_token: 'wrong' }));
  await assert.rejects(() => appleIdentity.verifyResponse({ idToken: token(), code: 'fresh-code', nonceHash: hashAppleChallenge('fresh-nonce') }, env));
});
