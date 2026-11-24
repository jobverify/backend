import express from 'express';
import { adminVideoRouter, videoAssetRouter } from './videoRoutes.js';
import mongoose from 'mongoose';
import SocialPost from '../models/SocialPost.js';
import SocialDelivery from '../models/SocialDelivery.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createRateLimiter } from '../utils/rateLimit.js';
import { MAX_IMAGE_BYTES, socialError, validateSocialJpeg } from './policy.js';
import { verifyPublisherToken } from './security.js';
import { approveSocialPost, cancelSocialPost, createSocialPost, editSocialPost, eligibleSocialJobs, getSocialSettings, publicSocialPost, publicSocialDelivery, reconcileSocialDelivery, refreshSocialPost, runSocialBatch, saveSocialSettings, setSocialImage } from './service.js';
import { beginSocialConnection, completeSocialConnection, disconnectSocialAccount, listSocialAccounts } from './accounts.js';

const send = (res, data, status = 200) => res.status(status).json({ success: true, data });
const objectId = id => { if (!mongoose.isObjectIdOrHexString(id)) throw socialError('Invalid social post ID.'); return id; };
const body = req => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw socialError('A JSON object is required.');
  return req.body;
};
const imageStore = req => {
  const store = req.app.locals.socialAssets;
  if (!store?.get || !store?.put) throw socialError('Social image storage is not configured.', 503);
  return store;
};
async function imageResponse(req, res, image, immutable = false) {
  const stored = image && await imageStore(req).get(image.key);
  if (!stored) return res.status(404).set('Cache-Control', 'no-store').end();
  res.set('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff').type('image/jpeg').send(Buffer.from(await stored.arrayBuffer()));
}
async function postDetails(id) {
  const post = await SocialPost.findById(objectId(id)).lean();
  if (!post) throw socialError('Social post not found.', 404);
  return { ...publicSocialPost(post), deliveries: (await SocialDelivery.find({ post: post._id }).sort({ createdAt: 1 }).lean()).map(publicSocialDelivery) };
}

// Mounted below the existing session and administrator guards in adminRoutes.
export const adminSocialRouter = express.Router();
adminSocialRouter.use(adminVideoRouter);
adminSocialRouter.get('/social-settings', asyncHandler(async (req, res) => {
  const settings = await getSocialSettings();
  send(res, { paused: settings.paused, revision: settings.revision, instagramDrafts: settings.instagramDrafts, lastRunAt: settings.lastRunAt, lastRunOutcome: settings.lastRunOutcome,
    timezone: 'Asia/Kolkata', slots: ['10:00', '18:00'], storageReady: Boolean(req.app.locals.socialAssets),
    identityReady: Boolean(process.env.SOCIAL_GITHUB_REPOSITORY_ID && process.env.SOCIAL_GITHUB_OWNER_ID && process.env.SOCIAL_OIDC_AUDIENCE) });
}));
adminSocialRouter.put('/social-settings', asyncHandler(async (req, res) => send(res, await saveSocialSettings(body(req), req.user._id))));
adminSocialRouter.get('/social-accounts', asyncHandler(async (_req, res) => send(res, await listSocialAccounts())));
adminSocialRouter.post('/social-accounts/:platform/connect', asyncHandler(async (req, res) => send(res, await beginSocialConnection(req.params.platform, req.user._id))));
adminSocialRouter.get('/social-accounts/:platform/callback', asyncHandler(async (req, res) => {
  let outcome = 'failed';
  try { await completeSocialConnection(req.params.platform, req.user._id, req.query.code, req.query.state); outcome = 'connected'; } catch { /* Do not expose OAuth codes, state or provider responses in redirects. */ }
  const url = new URL('/admin', process.env.FRONTEND_ORIGIN || 'https://www.jobverify.in');
  url.search = new URLSearchParams({ tab: 'social-publishing', connection: outcome }).toString(); res.redirect(303, url.href);
}));
adminSocialRouter.delete('/social-accounts/:platform', asyncHandler(async (req, res) => send(res, await disconnectSocialAccount(req.params.platform, req.user._id))));
adminSocialRouter.get('/social-posts/eligible-jobs', asyncHandler(async (req, res) => send(res, await eligibleSocialJobs(req.query.q || ''))));
adminSocialRouter.get('/social-posts', asyncHandler(async (req, res) => {
  const cursor = req.query.cursor;
  if (cursor) objectId(cursor);
  const posts = await SocialPost.find(cursor ? { _id: { $lt: cursor } } : {}).sort({ _id: -1 }).limit(21).lean();
  const rows = posts.slice(0, 20); const deliveries = await SocialDelivery.find({ post: { $in: rows.map(post => post._id) } }).lean();
  send(res, { posts: rows.map(post => ({ ...publicSocialPost(post), deliveries: deliveries.filter(delivery => String(delivery.post) === String(post._id)).map(publicSocialDelivery) })), nextCursor: posts.length > 20 ? String(rows.at(-1)._id) : null });
}));
adminSocialRouter.post('/social-posts', asyncHandler(async (req, res) => send(res, await createSocialPost(body(req).jobId, req.user._id), 201)));
adminSocialRouter.get('/social-posts/:id', asyncHandler(async (req, res) => send(res, await postDetails(req.params.id))));
adminSocialRouter.put('/social-posts/:id', asyncHandler(async (req, res) => send(res, await editSocialPost(req.params.id, body(req).revision, body(req).captions, req.user._id))));
adminSocialRouter.post('/social-posts/:id/refresh', asyncHandler(async (req, res) => send(res, await refreshSocialPost(req.params.id, body(req).revision, req.user._id))));
adminSocialRouter.put('/social-posts/:id/image', express.raw({ type: 'image/jpeg', limit: MAX_IMAGE_BYTES }), asyncHandler(async (req, res) => {
  objectId(req.params.id);
  const revision = /^\d+$/.test(req.get('x-social-revision') || '') ? Number(req.get('x-social-revision')) : NaN;
  const image = validateSocialJpeg(req.body, req.get('content-type'));
  await imageStore(req).put(image.key, req.body, { httpMetadata: { contentType: 'image/jpeg' }, customMetadata: { sha256: image.hash } });
  send(res, await setSocialImage(req.params.id, revision, image, req.user._id));
}));
adminSocialRouter.get('/social-posts/:id/image', asyncHandler(async (req, res) => {
  const post = await SocialPost.findById(objectId(req.params.id)).lean();
  if (!post) throw socialError('Social post not found.', 404);
  await imageResponse(req, res, post.image);
}));
adminSocialRouter.post('/social-posts/:id/approve', asyncHandler(async (req, res) => send(res, await approveSocialPost(req.params.id, body(req), req.user._id))));
adminSocialRouter.post('/social-posts/:id/cancel', asyncHandler(async (req, res) => send(res, await cancelSocialPost(req.params.id, body(req).revision, req.user._id))));
adminSocialRouter.post('/social-posts/:id/deliveries/:deliveryId/reconcile', asyncHandler(async (req, res) => send(res, await reconcileSocialDelivery(req.params.id, req.params.deliveryId, body(req), req.user._id))));

export const socialAssetRouter = express.Router();
socialAssetRouter.use(videoAssetRouter);
socialAssetRouter.get('/:hash.jpg', asyncHandler(async (req, res) => {
  const hash = req.params.hash;
  if (!/^[a-f0-9]{64}$/.test(hash)) return res.status(404).end();
  const approved = await SocialPost.exists({ 'image.hash': hash, approvalHash: { $type: 'string' } });
  const used = approved || await SocialDelivery.exists({ 'snapshot.image.hash': hash, status: { $in: ['processing', 'submitted', 'uncertain', 'published'] } });
  if (!used) return res.status(404).set('Cache-Control', 'no-store').end();
  await imageResponse(req, res, { key: `social/${hash}.jpg` }, true);
}));

export const socialPublisherRouter = express.Router();
socialPublisherRouter.use(createRateLimiter({ windowMs: 15 * 60_000, limit: 90, standardHeaders: true, legacyHeaders: false }));
socialPublisherRouter.post('/run', asyncHandler(async (req, _res, next) => {
  const bearer = /^Bearer (\S+)$/i.exec(req.get('authorization') || '');
  if (!bearer) throw socialError('GitHub publisher identity is required.', 401);
  req.socialIdentity = await verifyPublisherToken(bearer[1]); next();
}), express.json({ limit: '1kb' }), asyncHandler(async (req, res) => {
  if (!req.is('application/json')) throw socialError('Use application/json.', 415);
  const data = body(req);
  if (Object.keys(data).some(key => key !== 'batchId') || (data.batchId !== undefined && (typeof data.batchId !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.batchId)))) throw socialError('Only an optional batchId is accepted.');
  const result = await runSocialBatch({ batchId: data.batchId, runId: req.socialIdentity.run_id, assets: req.app.locals.socialAssets });
  res.set('Cache-Control', 'no-store'); send(res, result);
}));
