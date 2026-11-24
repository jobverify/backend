import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import SocialAccount from '../src/models/SocialAccount.js';
import SocialDelivery from '../src/models/SocialDelivery.js';
import SocialPost from '../src/models/SocialPost.js';
import SocialSettings from '../src/models/SocialSettings.js';
import AdminAudit from '../src/models/AdminAudit.js';
import { beginSocialConnection, completeSocialConnection, disconnectSocialAccount, listSocialAccounts } from '../src/social/accounts.js';
import { decryptSocialToken } from '../src/social/security.js';

test('OAuth connection challenges are account/admin bound, expiring, one-use, and encrypted', { timeout: 60_000 }, async t => {
  const mongo = await MongoMemoryReplSet.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) }, replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri()); await Promise.all([SocialAccount, SocialDelivery, SocialPost, SocialSettings, AdminAudit].map(model => model.init()));
  const admin = new mongoose.Types.ObjectId(); const other = new mongoose.Types.ObjectId();
  const env = { SOCIAL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), SOCIAL_LINKEDIN_CLIENT_ID: 'app', SOCIAL_LINKEDIN_CLIENT_SECRET: 'secret', SOCIAL_LINKEDIN_ORGANIZATION_ID: '1' };
  let exchanges = 0; const now = new Date('2026-11-20T00:00:00Z');
  const provider = { authorizationUrl: (_platform, state) => `https://www.linkedin.com/oauth/v2/authorization?state=${state}`,
    exchange: async () => { exchanges++; return { destination: 'urn:li:organization:1', label: 'Jobverify', scopes: ['w_organization_social', 'r_organization_social'], accessToken: 'secret-access', expiresIn: 5184000 }; } };
  const options = { env, now, provider };
  const begin = async () => new URL((await beginSocialConnection('linkedin', admin, options)).url).searchParams.get('state');
  const state = await begin();
  await assert.rejects(completeSocialConnection('linkedin', other, 'code', state, options));
  await assert.rejects(completeSocialConnection('instagram', admin, 'code', state, options));
  await assert.rejects(completeSocialConnection('linkedin', admin, 'code', 'wrong-state', options));
  await completeSocialConnection('linkedin', admin, 'code', state, options);
  await assert.rejects(completeSocialConnection('linkedin', admin, 'code', state, options)); assert.equal(exchanges, 1);
  const stored = await SocialAccount.findById('linkedin').select('+accessToken +pendingOAuth').lean();
  assert.equal(decryptSocialToken(stored.accessToken, env.SOCIAL_TOKEN_ENCRYPTION_KEY), 'secret-access');
  assert.equal(stored.pendingOAuth, undefined); assert.equal(stored.revision, 1);
  assert.doesNotMatch(JSON.stringify(await listSocialAccounts({ env })), /secret-access|accessToken|pendingOAuth|client-secret/);
  const expired = await begin(); await assert.rejects(completeSocialConnection('linkedin', admin, 'code', expired, { ...options, now: new Date('2026-11-20T00:11:00Z') }));
  await disconnectSocialAccount('linkedin', admin); assert.equal((await SocialAccount.findById('linkedin')).status, 'disconnected');
  assert.equal((await SocialAccount.findById('linkedin').select('+accessToken')).accessToken, undefined);
});
