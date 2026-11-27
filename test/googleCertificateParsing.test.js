import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { OAuth2Client } from 'google-auth-library';
import { googleIdentity } from '../src/utils/googleAuth.js';

test('Google verification requests intact signing keys and rejects invalid signatures', async t => {
  const before = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'fixture-client';
  t.after(() => {
    if (before === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = before;
  });
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const getCerts = OAuth2Client.prototype.getFederatedSignonCertsAsync;
  t.mock.method(OAuth2Client.prototype, 'getFederatedSignonCertsAsync', async function () {
    this.transporter.defaults.fetchImplementation = async (_url, options) => {
      const json = JSON.stringify({ fixture: publicKey.export({ type: 'spki', format: 'pem' }) });
      // Model Workers passing compressed Node HTTP response bytes through.
      const uncompressed = options.headers.get('accept-encoding') === 'identity';
      return new Response(uncompressed ? json : gzipSync(json), {
        headers: { 'content-type': 'application/json' },
      });
    };
    return getCerts.call(this);
  });
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = encode({ alg: 'RS256', kid: 'fixture' }) + '.' + encode({
    iss: 'https://accounts.google.com', aud: 'fixture-client', sub: 'fixture-sub',
    email: 'fixture@gmail.com', email_verified: true, iat: now, exp: now + 300,
  });
  const token = body + '.' + sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url');
  const identity = await googleIdentity.verifyCredential(token);
  assert.equal(identity.sub, 'fixture-sub');
  assert.equal(identity.emailVerified, true);
  await assert.rejects(googleIdentity.verifyCredential(token.slice(0, -10) + 'invalidsig'));
});

