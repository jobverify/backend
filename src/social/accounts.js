import { createHash, randomBytes } from 'node:crypto';
import SocialAccount from '../models/SocialAccount.js';
import SocialDelivery from '../models/SocialDelivery.js';
import SocialPost from '../models/SocialPost.js';
import { PLATFORMS, socialError } from './policy.js';
import { encryptSocialToken } from './security.js';
import { socialAccountConfig, socialProvider, SOCIAL_SCOPES } from './providers.js';
import { publicSocialAccount, socialAudit, socialTransaction } from './service.js';

const stateHash = state => createHash('sha256').update(state).digest('hex');
const platformGuard = platform => { if (!PLATFORMS.includes(platform)) throw socialError('Unknown social platform.'); };
async function assertAccountIdle(platform, session) {
  if (await SocialDelivery.exists({ platform, status: { $in: ['processing', 'submitted'] } }).session(session)) throw socialError('Wait for in-flight deliveries to finish before changing this account.', 409);
}
async function invalidateAccountApprovals(platform, session) {
  const posts = await SocialDelivery.distinct('post', { platform, status: 'queued' }).session(session);
  if (!posts.length) return;
  await SocialDelivery.updateMany({ post: { $in: posts }, platform, status: 'queued' }, { $set: { status: 'needs_review', reserved: false, reason: 'account_changed' }, $unset: { slot: 1, batchId: 1 } }, { session });
  await SocialPost.updateMany({ _id: { $in: posts } }, { $set: { status: 'needs_review' }, $inc: { revision: 1 } }, { session });
}
export async function listSocialAccounts({ env = process.env } = {}) {
  const accounts = await SocialAccount.find().lean();
  return PLATFORMS.map(platform => {
    let configured = true; try { socialAccountConfig(platform, env); } catch { configured = false; }
    return { ...publicSocialAccount(accounts.find(account => account._id === platform) || { _id: platform, status: 'disconnected', revision: 0 }), configured };
  });
}
export async function beginSocialConnection(platform, admin, { env = process.env, now = new Date(), provider = socialProvider } = {}) {
  platformGuard(platform); const config = socialAccountConfig(platform, env);
  const state = randomBytes(32).toString('base64url');
  await socialTransaction(async (session) => {
    const account = await SocialAccount.findById(platform).session(session) || new SocialAccount({ _id: platform });
    account.pendingOAuth = { hash: stateHash(state), admin: String(admin), destination: config.destination, revision: account.revision, expiresAt: new Date(now.getTime() + 10 * 60_000) };
    await account.save({ session });
  });
  return { url: provider.authorizationUrl(platform, state) };
}
export async function completeSocialConnection(platform, admin, code, state, { env = process.env, now = new Date(), provider = socialProvider } = {}) {
  platformGuard(platform); const config = socialAccountConfig(platform, env);
  if (typeof code !== 'string' || !code || code.length > 4096 || typeof state !== 'string' || !/^[\w-]{43}$/.test(state)) throw socialError('Invalid social connection response.');
  const challenge = await socialTransaction(async session => {
    const account = await SocialAccount.findById(platform).session(session).select('+pendingOAuth');
    const pending = account?.pendingOAuth;
    if (!pending || pending.hash !== stateHash(state) || pending.admin !== String(admin) || pending.destination !== config.destination || pending.expiresAt <= now || pending.revision !== account.revision) throw socialError('This connection request expired or belongs to another administrator.', 409);
    account.pendingOAuth = undefined; await account.save({ session }); return pending;
  });
  const tokens = await provider.exchange(platform, code);
  if (tokens.destination !== config.destination || !Array.isArray(tokens.scopes) || SOCIAL_SCOPES[platform].some(scope => !tokens.scopes.includes(scope))
    || !Number.isFinite(tokens.expiresIn) || tokens.expiresIn < 60) throw socialError('The account or granted permissions do not match the configured destination.', 409);
  return socialTransaction(async session => {
    await assertAccountIdle(platform, session);
    const account = await SocialAccount.findById(platform).session(session);
    if (!account || account.revision !== challenge.revision) throw socialError('This connection changed. Connect again.', 409);
    await invalidateAccountApprovals(platform, session);
    Object.assign(account, { destination: tokens.destination, label: tokens.label, scopes: tokens.scopes, status: 'ready',
      accessToken: encryptSocialToken(tokens.accessToken, env.SOCIAL_TOKEN_ENCRYPTION_KEY),
      refreshToken: tokens.refreshToken ? encryptSocialToken(tokens.refreshToken, env.SOCIAL_TOKEN_ENCRYPTION_KEY) : undefined,
      expiresAt: new Date(now.getTime() + tokens.expiresIn * 1000), tokenIssuedAt: now,
      refreshExpiresAt: tokens.refreshExpiresIn ? new Date(now.getTime() + tokens.refreshExpiresIn * 1000) : undefined,
      connectedBy: admin,
    });
    account.revision++; await account.save({ session });
    await socialAudit(admin, 'social_account_connected', 'SocialAccount', null, session, platform);
    return publicSocialAccount(account);
  });
}
export async function disconnectSocialAccount(platform, admin) {
  platformGuard(platform);
  return socialTransaction(async session => {
    await assertAccountIdle(platform, session); await invalidateAccountApprovals(platform, session);
    await SocialAccount.updateOne({ _id: platform }, { $set: { status: 'disconnected' }, $inc: { revision: 1 }, $unset: { accessToken: 1, refreshToken: 1, pendingOAuth: 1, expiresAt: 1, refreshExpiresAt: 1 } }, { session, upsert: true });
    await socialAudit(admin, 'social_account_disconnected', 'SocialAccount', null, session, platform);
    return { platform, status: 'disconnected' };
  });
}
