import express from 'express';
import mongoose from 'mongoose';
import SocialPost from '../models/SocialPost.js';
import SocialDelivery from '../models/SocialDelivery.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createRateLimiter } from '../utils/rateLimit.js';
import { socialError } from './policy.js';
import { VIDEO_LIMITS, validateVideoArtifact } from './videoPolicy.js';
import { verifyVideoRendererToken } from './security.js';
import { claimVideoDraft, heartbeatVideoDraft, recordVideoUpload, completeVideoDraft, failVideoDraft, retryVideoDraft } from './videoService.js';
import { socialAssetStore, streamSocialAsset } from './assetStream.js';

const send = (res, data) => res.set('Cache-Control', 'no-store').json({ success: true, data });
const body = req => { if (!req.is('application/json') || !req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw socialError('A JSON object is required.'); return req.body; };
const objectId = value => { if (!mongoose.isObjectIdOrHexString(value)) throw socialError('Invalid social post ID.'); return value; };
const kindField = { video: 'mp4', cover: 'cover', subtitles: 'subtitles' };
export const socialVideoRouter = express.Router();
socialVideoRouter.use(createRateLimiter({ windowMs: 15 * 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
socialVideoRouter.use(asyncHandler(async (req, _res, next) => {
  const bearer = /^Bearer (\S+)$/i.exec(req.get('authorization') || '');
  if (!bearer) throw socialError('GitHub renderer identity is required.', 401);
  req.socialIdentity = await verifyVideoRendererToken(bearer[1]); next();
}));
socialVideoRouter.post('/claim', express.json({ limit: '1kb' }), asyncHandler(async (req, res) => {
  if (Object.keys(body(req)).length) throw socialError('Claim accepts an empty object.');
  send(res, await claimVideoDraft({ runId: req.socialIdentity.run_id }));
}));
socialVideoRouter.post('/heartbeat', express.json({ limit: '2kb' }), asyncHandler(async (req, res) => send(res, await heartbeatVideoDraft(body(req)))));
socialVideoRouter.put('/:postId/assets/:kind', (req, _res, next) => {
  if (!Object.hasOwn(VIDEO_LIMITS, req.params.kind)) return next(socialError('Invalid artifact kind.', 404));
  express.raw({ type: () => true, limit: VIDEO_LIMITS[req.params.kind] })(req, _res, next);
}, asyncHandler(async (req, res) => {
  const asset = validateVideoArtifact(req.params.kind, req.body, req.get('content-type'));
  const revision = /^\d+$/.test(req.get('x-social-revision') || '') ? Number(req.get('x-social-revision')) : NaN;
  const store = socialAssetStore(req);
  send(res, await recordVideoUpload({ postId: req.params.postId, kind: req.params.kind, renderId: req.get('x-social-render-id'), leaseToken: req.get('x-social-lease'), revision }, asset,
    { put: () => store.put(asset.key, req.body, { httpMetadata: { contentType: asset.type }, customMetadata: { sha256: asset.hash } }) }));
}));
socialVideoRouter.post('/complete', express.json({ limit: '8kb' }), asyncHandler(async (req, res) => send(res, await completeVideoDraft(body(req)))));
socialVideoRouter.post('/fail', express.json({ limit: '2kb' }), asyncHandler(async (req, res) => send(res, await failVideoDraft(body(req)))));

// Mounted inside the existing session/administrator guards.
export const adminVideoRouter = express.Router();
adminVideoRouter.post('/social-posts/:id/retry-video', asyncHandler(async (req, res) => send(res, await retryVideoDraft(req.params.id, body(req).revision, req.user._id))));
adminVideoRouter.get('/social-posts/:id/video/:kind', asyncHandler(async (req, res) => {
  if (!Object.hasOwn(kindField, req.params.kind)) throw socialError('Unknown video artifact.', 404);
  const post = await SocialPost.findById(objectId(req.params.id)).lean(); if (!post) throw socialError('Social post not found.', 404);
  await streamSocialAsset(req, res, post.video?.[kindField[req.params.kind]]);
}));

export const videoAssetRouter = express.Router();
for (const [extension, field] of [['mp4', 'mp4'], ['jpg', 'cover']]) videoAssetRouter.get(`/:hash.${extension}`, asyncHandler(async (req, res, next) => {
  const { hash } = req.params; if (!/^[a-f0-9]{64}$/.test(hash)) return res.status(404).end();
  const path = `video.${field}.hash`;
  let post = await SocialPost.findOne({ [path]: hash, approvalHash: { $type: 'string' } }).lean();
  let asset = post?.video?.[field];
  if (!asset) {
    const delivery = await SocialDelivery.findOne({ [`snapshot.${path}`]: hash, platform: 'instagram', status: { $in: ['processing', 'submitted', 'uncertain', 'published'] } }).lean();
    asset = delivery?.snapshot?.video?.[field];
  }
  if (!asset) return extension === 'jpg' ? next() : res.status(404).set('Cache-Control', 'no-store').end();
  await streamSocialAsset(req, res, asset, true);
}));
