import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { encryptSocialToken, decryptSocialToken, verifyPublisherToken } from '../src/social/security.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' };
const env = { SOCIAL_GITHUB_REPOSITORY_ID: '123', SOCIAL_GITHUB_OWNER_ID: '456', SOCIAL_GITHUB_REPOSITORY: 'jobverify/backend', SOCIAL_OIDC_AUDIENCE: 'https://api.jobverify.in/api/social-publisher/run' };
const claims = { repository_id: '123', repository_owner_id: '456', repository: 'jobverify/backend', ref: 'refs/heads/main', workflow_ref: 'jobverify/backend/.github/workflows/social-publisher.yml@refs/heads/main', event_name: 'schedule', sub: 'repo:jobverify/backend:ref:refs/heads/main', run_id: '987' };
const token = overrides => jwt.sign({ ...claims, ...overrides }, privateKey, { algorithm: 'RS256', keyid: 'test', issuer: 'https://token.actions.githubusercontent.com', audience: env.SOCIAL_OIDC_AUDIENCE, expiresIn: 300 });

test('publisher OIDC verifies the signed identity and rejects other repositories, workflows, refs and events', async () => {
  assert.equal((await verifyPublisherToken(token(), { env, keys: [jwk] })).run_id, '987');
  for (const changed of [{ repository_id: '999' }, { repository_owner_id: '999' }, { repository: 'fork/backend' }, { ref: 'refs/heads/dev' }, { event_name: 'pull_request' }, { workflow_ref: 'jobverify/backend/.github/workflows/scraper.yml@refs/heads/main' }, { aud: 'other' }, { iss: 'https://evil.example' }, { exp: Math.floor(Date.now() / 1000) - 10 }]) {
    const body = { ...claims, ...changed, iss: changed.iss || 'https://token.actions.githubusercontent.com', aud: changed.aud || env.SOCIAL_OIDC_AUDIENCE, exp: changed.exp || Math.floor(Date.now() / 1000) + 300 };
    await assert.rejects(verifyPublisherToken(jwt.sign(body, privateKey, { algorithm: 'RS256', keyid: 'test' }), { env, keys: [jwk] }));
  }
  await assert.rejects(verifyPublisherToken(token(), { env: {}, keys: [jwk] }));
  await assert.rejects(verifyPublisherToken(jwt.sign(claims, 'wrong-key'), { env, keys: [jwk] }));
});

test('social tokens are independently encrypted and fail closed on corruption or key changes', () => {
  const key = Buffer.alloc(32, 1).toString('base64');
  const encrypted = encryptSocialToken('provider-secret', key);
  assert.doesNotMatch(encrypted, /provider-secret/);
  assert.equal(decryptSocialToken(encrypted, key), 'provider-secret');
  assert.notEqual(encryptSocialToken('provider-secret', key), encrypted);
  assert.throws(() => decryptSocialToken(encrypted, Buffer.alloc(32, 2).toString('base64')));
  assert.throws(() => decryptSocialToken(`${encrypted}x`, key));
  assert.throws(() => encryptSocialToken('provider-secret', 'short'));
});
