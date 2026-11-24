import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import Job from '../models/Job.js';
import AdminAudit from '../models/AdminAudit.js';
import SocialPost from '../models/SocialPost.js';
import SocialDelivery from '../models/SocialDelivery.js';
import SocialAccount from '../models/SocialAccount.js';
import SocialSettings from '../models/SocialSettings.js';
import { getSiteSettings } from '../services/siteSettingsService.js';
import { canProcessClassifiedJobAlerts } from '../services/jobAlertClassificationGate.js';
import { normalizeJobListResponseJob } from '../controllers/jobController.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';
import { safeSourceUrl } from '../utils/jobProvenance.js';
import { approvalDigest, BATCH_MS, defaultSocialCaptions, dueSocialSlot, factsDigest, GRACE_MS, parseSocialSlot, PLATFORMS, socialError, socialFacts, validateCaptions } from './policy.js';
import { normalizeVideoPreferences } from './videoPolicy.js';
import { encryptSocialToken } from './security.js';

const pending = ['queued', 'processing', 'submitted'];
const defaultProvider = async provider => provider ?? (await import('./providers.js')).socialProvider;
const origin = () => process.env.PUBLIC_API_ORIGIN || 'https://api.jobverify.in';
export const publicSocialImageUrl = hash => `${origin()}/api/social-assets/${hash}.jpg`;
const asObject = value => value?.toObject ? value.toObject() : value;
export function publicSocialPost(post) {
  const row = { ...asObject(post) };
  if (row.generation) {
    row.generation = { ...row.generation };
    for (const key of ['leaseToken', 'uploads', 'completionDigest']) delete row.generation[key];
  }
  return row;
}
function invalidateRendering(post, state = 'queued') {
  if (post.origin !== 'instagram_auto') return;
  const exhausted = state === 'queued' && post.generation?.attempts >= 3;
  post.generation = { ...post.generation, state: exhausted ? 'failed' : state, ...(exhausted ? { retryable: false, reason: 'runner_failed' } : {}), leaseToken: undefined, leaseUntil: null, uploads: {}, completionDigest: null };
}

export const publicSocialAccount = account => ({ platform: account._id, destination: account.destination || '', label: account.label || '', revision: account.revision,
  status: account.expiresAt && account.expiresAt <= new Date() ? 'reconnect' : account.status, expiresAt: account.expiresAt, scopes: account.scopes || [] });
export const publicSocialDelivery = delivery => {
  const row = { ...asObject(delivery) };
  delete row.providerState; delete row.leaseToken; delete row.__v;
  return row;
};

export async function getSocialSettings() {
  await SocialSettings.updateOne({ _id: 'global' }, { $setOnInsert: { paused: true, revision: 0, fence: 0 } }, { upsert: true });
  return SocialSettings.findById('global');
}

// Every admin mutation and dispatch boundary writes this same document. Mongo's
// transaction conflict retry orders pause, approval, cancellation and send claims.
export async function socialTransaction(action) {
  await getSocialSettings();
  try {
    return await mongoose.connection.transaction(async session => {
      const settings = await SocialSettings.findByIdAndUpdate('global', { $inc: { fence: 1 } }, { session, new: true });
      const result = await action(session, settings);
      if (settings.isModified()) await settings.save({ session });
      return result;
    });
  } catch (error) {
    if (error.code === 11000) throw socialError('This job or publishing slot is already reserved. Refresh the queue.', 409);
    throw error;
  }
}

export async function socialAudit(admin, action, targetType, targetId, session, details = '') {
  await AdminAudit.create([{ admin, action, targetType, targetId, details }], { session });
}

function jobFilter(now, extra = {}) {
  return { status: 'active', 'sourceAvailability.state': { $ne: 'closed' },
    $or: [{ closingDate: null }, { closingDate: { $gt: now } }], ...extra };
}
export async function eligibleSocialJobs(search = '', now = new Date()) {
  if (typeof search !== 'string' || search.length > 100) throw socialError('Search must be at most 100 characters.');
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rows = await Job.find(applyPublicJobVisibility(jobFilter(now, escaped ? { $and: [{ $or: [{ title: new RegExp(escaped, 'i') }, { company: new RegExp(escaped, 'i') }] }] } : {}), await getSiteSettings(), now))
    .sort({ createdAt: -1 }).limit(40).lean();
  return rows.map(row => ({ row, normalized: normalizeJobListResponseJob(row) })).filter(({ row, normalized }) => row.fingerprint && normalized.applicationStatus === 'available'
    && safeSourceUrl(normalized.sourceUrl) && normalized.description?.trim().length >= 120)
    .map(({ row, normalized }) => ({ id: String(row._id), fingerprint: row.fingerprint, ...socialFacts(normalized) }));
}
export async function eligibleSocialJob(id, now = new Date(), session = null) {
  if (!mongoose.isObjectIdOrHexString(id)) throw socialError('Invalid job ID.');
  const row = await Job.findOne(applyPublicJobVisibility(jobFilter(now, { _id: id }), await getSiteSettings(), now)).session(session).lean();
  const job = row && normalizeJobListResponseJob(row);
  if (!row?.fingerprint || job.applicationStatus !== 'available' || !safeSourceUrl(job.sourceUrl) || !(job.description?.trim().length >= 120)) return null;
  const facts = socialFacts(job);
  return { fingerprint: row.fingerprint, facts, factsHash: factsDigest(facts) };
}
async function postForEdit(id, revision, session) {
  if (!mongoose.isObjectIdOrHexString(id) || !Number.isInteger(revision) || revision < 0) throw socialError('A valid post ID and revision are required.');
  const post = await SocialPost.findById(id).session(session);
  if (!post) throw socialError('Social post not found.', 404);
  if (post.revision !== revision) throw socialError('This post changed. Refresh before editing.', 409);
  if (await SocialDelivery.exists({ post: id, status: { $in: ['processing', 'submitted', 'uncertain'] } }).session(session)) throw socialError('Resolve in-flight or uncertain deliveries before editing this post.', 409);
  return post;
}
async function invalidate(post, session, status = 'needs_review') {
  post.approvalHash = null; post.approvedAt = undefined; post.approvedBy = undefined;
  await SocialDelivery.updateMany({ post: post._id, status: { $nin: ['published', 'uncertain', 'submitted'] } },
    { $set: { status, reserved: false, reason: status === 'cancelled' ? 'cancelled_by_admin' : 'approval_changed' }, $unset: { slot: 1, batchId: 1 } }, { session });
}

export async function createSocialPost(jobId, admin, { now = new Date() } = {}) {
  return socialTransaction(async session => {
    const job = await eligibleSocialJob(jobId, now, session);
    if (!job) throw socialError('This job is not currently eligible for public promotion.');
    const [post] = await SocialPost.create([{ job: jobId, ...job, captions: defaultSocialCaptions(job.facts, process.env.FRONTEND_ORIGIN || 'https://www.jobverify.in'), createdBy: admin }], { session });
    await socialAudit(admin, 'social_post_created', 'SocialPost', post._id, session);
    return publicSocialPost(post);
  });
}
export async function editSocialPost(id, revision, captions, admin) {
  const valid = validateCaptions(captions);
  return socialTransaction(async session => {
    const post = await postForEdit(id, revision, session); await invalidate(post, session);
    post.captions = valid; post.status = 'draft'; if (post.generation?.state === 'rendering') invalidateRendering(post); post.revision++;
    await post.save({ session }); await socialAudit(admin, 'social_post_edited', 'SocialPost', post._id, session);
    return publicSocialPost(post);
  });
}
export async function refreshSocialPost(id, revision, admin, { now = new Date() } = {}) {
  return socialTransaction(async session => {
    const post = await postForEdit(id, revision, session); const job = await eligibleSocialJob(String(post.job), now, session);
    if (!job) throw socialError('This job is no longer eligible for promotion.');
    await invalidate(post, session); invalidateRendering(post); if (post.origin === 'instagram_auto') post.generation = { ...post.generation, state: 'queued', attempts: 0 }; Object.assign(post, job, { image: null, video: null, status: 'draft', captions: defaultSocialCaptions(job.facts, process.env.FRONTEND_ORIGIN || 'https://www.jobverify.in') }); post.revision++;
    await post.save({ session }); await socialAudit(admin, 'social_post_refreshed', 'SocialPost', post._id, session);
    return publicSocialPost(post);
  });
}
export async function setSocialImage(id, revision, image, admin) {
  return socialTransaction(async session => {
    const post = await postForEdit(id, revision, session); await invalidate(post, session);
    post.image = image; post.status = 'draft'; if (post.generation?.state === 'rendering') invalidateRendering(post); post.revision++;
    await post.save({ session }); await socialAudit(admin, 'social_image_uploaded', 'SocialPost', post._id, session, image.hash);
    return publicSocialPost(post);
  });
}

export async function approveSocialPost(id, body, admin, { now = new Date() } = {}) {
  const slot = parseSocialSlot(body.slot, now);
  const platforms = body.platforms ?? PLATFORMS;
  if (!Array.isArray(platforms) || !platforms.length || platforms.length > 2 || new Set(platforms).size !== platforms.length || platforms.some(platform => !PLATFORMS.includes(platform))) throw socialError('Choose LinkedIn and/or Instagram.');
  return socialTransaction(async session => {
    const post = await postForEdit(id, body.revision, session);
    const reel = post.instagramMediaType === 'reel';
    if ((!reel || platforms.includes('linkedin')) && !post.image?.hash) throw socialError('Upload and preview the image before approval.');
    if (reel && platforms.includes('instagram') && (post.generation?.state !== 'ready' || !post.video?.mp4?.hash || !post.video?.cover?.hash || !post.video?.subtitles?.hash || post.video.factsHash !== post.factsHash)) throw socialError('Generate and preview the ready video before approval.');
    post.captions = validateCaptions(post.captions);
    if (!await canProcessClassifiedJobAlerts()) throw socialError('Wait for classification to complete before approval.', 409);
    const job = await eligibleSocialJob(String(post.job), now, session);
    if (!job || job.fingerprint !== post.fingerprint) throw socialError('This job is no longer eligible for promotion.', 409);
    if (job.factsHash !== post.factsHash) throw socialError('Job facts changed. Refresh the draft and preview it again.', 409);
    const accounts = await SocialAccount.find().session(session).lean();
    const selected = accounts.filter(account => platforms.includes(account._id));
    if (selected.length !== platforms.length || selected.some(account => account.status !== 'ready' || !account.destination || !account.expiresAt || account.expiresAt <= now)) throw socialError('Connect valid publishing accounts before approval.', 409);
    const previous = await SocialDelivery.find({ post: id }).session(session).lean();
    const remaining = selected.filter(account => !previous.some(delivery => delivery.platform === account._id && delivery.destination === account.destination && delivery.status === 'published'));
    if (!remaining.length) throw socialError('The selected destinations are already published.', 409);
    await invalidate(post, session);
    const approvalAccounts = remaining.map(account => ({ platform: account._id, destination: account.destination, revision: account.revision }));
    const hash = approvalDigest(post, approvalAccounts);
    for (const account of remaining) {
      await SocialDelivery.updateOne({ post: id, platform: account._id, destination: account.destination, fingerprint: post.fingerprint }, {
        $set: { accountRevision: account.revision, slot, reserved: true, status: 'queued', phase: 'prepare',
          snapshot: { facts: post.facts, factsHash: post.factsHash, caption: post.captions[account._id], image: post.image, approvalHash: hash, ...(reel && account._id === 'instagram' ? { instagramMediaType: 'reel', video: post.video } : {}) },
          providerState: {}, attempts: 0, reason: '' },
        $unset: { batchId: 1, batchDeadline: 1, nextPollAt: 1, publishStartedAt: 1, providerId: 1, startedAt: 1, leaseUntil: 1, leaseToken: 1 },
      }, { session, upsert: true, runValidators: true });
    }
    post.approvalHash = hash; post.approvalAccounts = approvalAccounts; post.approvedBy = admin; post.approvedAt = now; post.status = 'approved'; post.revision++;
    await post.save({ session }); await socialAudit(admin, 'social_post_approved', 'SocialPost', post._id, session, `${slot.toISOString()} ${remaining.map(a => a._id).join(',')}`);
    return publicSocialPost(post);
  });
}
export async function cancelSocialPost(id, revision, admin) {
  return socialTransaction(async session => {
    const post = await postForEdit(id, revision, session); await invalidate(post, session, 'cancelled'); invalidateRendering(post, 'cancelled'); post.status = 'cancelled'; post.revision++;
    await post.save({ session }); await socialAudit(admin, 'social_post_cancelled', 'SocialPost', post._id, session); return publicSocialPost(post);
  });
}
export async function saveSocialSettings(body, admin) {
  if (!Number.isInteger(body.revision) || body.revision < 0 || (body.paused !== undefined && typeof body.paused !== 'boolean') || (body.paused === undefined && body.instagramDrafts === undefined)) throw socialError('A settings value and current revision are required.');
  return socialTransaction(async (session, settings) => {
    if (body.revision !== settings.revision) throw socialError('Publishing settings changed. Refresh and try again.', 409);
    if (body.paused !== undefined) settings.paused = body.paused;
    if (body.instagramDrafts !== undefined) {
      const prefs = normalizeVideoPreferences(body.instagramDrafts, settings.instagramDrafts);
      settings.instagramDrafts = { ...settings.instagramDrafts, ...prefs, configuredBy: admin, configuredAt: new Date() };
    }
    settings.revision++;
    await socialAudit(admin, body.instagramDrafts !== undefined ? 'social_video_preferences_saved' : body.paused ? 'social_publishing_paused' : 'social_publishing_resumed', 'SocialSettings', null, session);
    return { paused: settings.paused, revision: settings.revision, instagramDrafts: settings.instagramDrafts };
  });
}

async function expireDeliveries(now, session) {
  await SocialDelivery.updateMany({ status: 'queued', slot: { $lte: new Date(now.getTime() - GRACE_MS) }, batchId: { $exists: false } }, { $set: { status: 'missed', reason: 'schedule_missed' } }, { session });
  await SocialDelivery.updateMany({ status: { $in: pending }, batchDeadline: { $lte: now }, publishStartedAt: { $exists: false } },
    { $set: { status: 'failed', reason: 'batch_deadline', reserved: false }, $unset: { leaseToken: 1, leaseUntil: 1 } }, { session });
  await SocialDelivery.updateMany({ $and: [
    { $or: [{ status: 'submitted' }, { status: { $in: pending }, batchDeadline: { $lte: now }, publishStartedAt: { $exists: true } }] },
    { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
  ] },
    { $set: { status: 'uncertain', reason: 'publish_outcome_unknown' }, $unset: { leaseToken: 1, leaseUntil: 1 } }, { session });
}
async function validateDispatch(delivery, session, now) {
  const post = await SocialPost.findById(delivery.post).session(session);
  const accounts = await SocialAccount.find().session(session).select('+accessToken +refreshToken').lean();
  const account = accounts.find(item => item._id === delivery.platform);
  let status; let reason;
  if ((delivery.snapshot.instagramMediaType === 'reel' && (post?.generation?.state !== 'ready' || !post?.video?.mp4?.hash)) || !post?.approvalHash || post.approvalHash !== delivery.snapshot.approvalHash || approvalDigest(post, post.approvalAccounts) !== post.approvalHash) { status = 'needs_review'; reason = 'approval_changed'; }
  else if (!account || account.status !== 'ready' || account.destination !== delivery.destination || account.revision !== delivery.accountRevision || !account.expiresAt || account.expiresAt <= now) { status = 'failed'; reason = 'account_reconnect_required'; }
  else if (!await canProcessClassifiedJobAlerts()) { status = 'needs_review'; reason = 'classification_not_ready'; }
  else {
    const job = await eligibleSocialJob(String(post.job), now, session);
    if (!job || job.fingerprint !== post.fingerprint) { status = 'cancelled'; reason = 'job_unavailable'; }
    else if (job.factsHash !== delivery.snapshot.factsHash) { status = 'needs_review'; reason = 'job_facts_changed'; }
  }
  if (status) {
    const accountFailure = reason === 'account_reconnect_required';
    await SocialDelivery.updateMany({ ...(accountFailure ? { _id: delivery._id } : { post: delivery.post }), status: { $in: ['queued', 'processing'] }, publishStartedAt: { $exists: false } }, { $set: { status, reason, reserved: false } }, { session });
    if (post) { post.status = status === 'cancelled' ? 'cancelled' : 'needs_review'; if (!accountFailure) post.approvalHash = null; post.revision++; await post.save({ session }); }
    return null;
  }
  return account;
}
async function batchSummary(batch, now, outcome) {
  const rows = batch ? await SocialDelivery.find({ batchId: batch.id }).lean() : [];
  const active = rows.filter(row => pending.includes(row.status));
  const next = active.map(row => row.nextPollAt > now ? row.nextPollAt : row.leaseUntil > now ? row.leaseUntil : now).sort((a, b) => a - b)[0];
  return { batchId: batch?.id, done: !active.length, deadline: batch?.deadline, nextPollAt: next,
    outcome: outcome || (active.length ? 'running' : rows.some(row => row.status !== 'published') ? 'partial_failure' : rows.length ? 'published' : 'no_work'),
    deliveries: rows.map(row => ({ platform: row.platform, status: row.status, reason: row.reason, providerId: row.providerId, permalink: row.permalink })) };
}

async function finishSocialBatch(batch, result) {
  if (!batch || !result.done || result.outcome === 'paused') return;
  await socialTransaction(async (session, settings) => {
    if (settings.activeBatch?.id === batch.id) settings.lastRunOutcome = result.outcome;
    const posts = await SocialDelivery.distinct('post', { batchId: batch.id }).session(session);
    for (const id of posts) {
      const rows = await SocialDelivery.find({ post: id }).select('status').session(session).lean();
      if (rows.some(row => pending.includes(row.status))) continue;
      const status = rows.every(row => row.status === 'published') ? 'complete' : rows.every(row => row.status === 'cancelled') ? 'cancelled' : 'needs_review';
      await SocialPost.updateOne({ _id: id, status: { $ne: status } }, { $set: { status }, $inc: { revision: 1 } }, { session });
    }
  });
}

export async function runSocialBatch({ batchId, runId, now = new Date(), provider, assets } = {}) {
  const due = dueSocialSlot(now);
  const claim = await socialTransaction(async (session, settings) => {
    await expireDeliveries(now, session); settings.lastRunAt = now;
    if (batchId && (typeof batchId !== 'string' || batchId !== settings.activeBatch?.id)) throw socialError('Unknown publishing batch.', 409);
    let batch = settings.activeBatch;
    if (!batchId && (!batch || batch.slot.getTime() !== due.slot.getTime())) {
      if (settings.paused) { settings.lastRunOutcome = 'paused'; return { outcome: 'paused' }; }
      if (!due.claimable) { settings.lastRunOutcome = 'missed'; return { outcome: 'missed' }; }
      batch = { id: randomUUID(), slot: due.slot, startedAt: now, deadline: new Date(now.getTime() + BATCH_MS), runId: String(runId || '') };
      settings.activeBatch = batch;
      await SocialDelivery.updateMany({ slot: due.slot, status: 'queued', reserved: true, batchId: { $exists: false } }, { $set: { batchId: batch.id, batchDeadline: batch.deadline } }, { session });
    }
    if (!batch || batch.deadline <= now) return { batch, outcome: batch ? undefined : 'no_work' };
    if (settings.paused) { settings.lastRunOutcome = 'paused'; return { batch, outcome: 'paused' }; }
    const delivery = await SocialDelivery.findOne({ batchId: batch.id, status: { $in: ['queued', 'processing'] },
      $and: [{ $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] }, { $or: [{ nextPollAt: null }, { nextPollAt: { $lte: now } }] }] })
      .sort({ platform: 1 }).session(session).select('+providerState +leaseToken');
    if (!delivery) return { batch, ...(settings.paused ? { outcome: 'paused' } : {}) };
    const account = await validateDispatch(delivery, session, now);
    if (!account) return { batch };
    if (delivery.platform === 'instagram' && delivery.phase === 'poll') {
      if ((delivery.providerState.polls || 0) >= 5) {
        delivery.status = 'failed'; delivery.reason = 'processing_timeout'; delivery.reserved = false;
        await delivery.save({ session }); return { batch };
      }
      // Persist every check before the HTTP request, including failed checks.
      delivery.providerState = { ...delivery.providerState, polls: (delivery.providerState.polls || 0) + 1 };
      delivery.nextPollAt = new Date(now.getTime() + 60_000);
    }
    delivery.leaseToken = randomUUID(); delivery.leaseUntil = new Date(now.getTime() + 90_000);
    delivery.status = delivery.phase === 'publish' ? 'submitted' : 'processing';
    if (delivery.phase === 'publish') delivery.publishStartedAt = now;
    delivery.startedAt ??= now; delivery.attempts++;
    await delivery.save({ session });
    await SocialPost.updateOne({ _id: delivery.post }, { $set: { status: 'publishing' } }, { session });
    return { batch, delivery: delivery.toObject(), account };
  });
  if (!claim.delivery) {
    const result = await batchSummary(claim.batch, now, claim.outcome);
    // A pause must finish this workflow even when an unstarted channel remains.
    if (claim.outcome === 'paused') result.done = true;
    await finishSocialBatch(claim.batch, result);
    return result;
  }
  const { delivery, account, batch } = claim;
  const where = { _id: delivery._id, leaseToken: delivery.leaseToken };
  const impl = await defaultProvider(provider);
  let publicationAccepted = false;
  try {
    let result;
    if (delivery.phase === 'publish') {
      result = await impl.publish(delivery, account);
      publicationAccepted = true;
      if (!result?.providerId) throw new Error('Missing publication receipt');
      if (delivery.snapshot.instagramMediaType === 'reel') {
        // Persist the returned ID before a read request can fail. A failed or
        // mismatched receipt remains quarantined for read-only reconciliation.
        await SocialDelivery.updateOne(where, { $set: { ...result, status: 'submitted' } });
        const receipt = await impl.receipt(delivery, account, result.providerId);
        if (!receipt?.published) throw new Error('Unverified Reel publication receipt');
        result = { ...result, permalink: receipt.permalink || result.permalink || '' };
      }
      await SocialDelivery.updateOne(where, { $set: { ...result, status: 'published', phase: 'done', publishedAt: now, reason: '' }, $unset: { nextPollAt: 1 } });
    } else {
      const getImage = async () => {
        if (!assets?.get) throw socialError('Social image storage is unavailable.', 503);
        const image = await assets.get(delivery.snapshot.image.key);
        if (!image) throw socialError('Approved image is unavailable.', 503);
        return Buffer.from(await image.arrayBuffer());
      };
      result = await impl.step(delivery, account, { now, getImage, imageUrl: delivery.snapshot.image?.hash ? publicSocialImageUrl(delivery.snapshot.image.hash) : undefined, videoUrl: delivery.snapshot.video?.mp4?.hash ? `${origin()}/api/social-assets/${delivery.snapshot.video.mp4.hash}.mp4` : undefined, coverUrl: delivery.snapshot.video?.cover?.hash ? publicSocialImageUrl(delivery.snapshot.video.cover.hash) : undefined });
      await SocialDelivery.updateOne(where, { $set: { ...result, status: 'processing', reason: '' } });
    }
  } catch (error) {
    // A receipt GET cannot reject a preceding accepted publication. Preserve
    // its reservation and ID for read-only reconciliation after any later error.
    const uncertain = delivery.phase === 'publish' && (publicationAccepted || !error.rejected);
    const instagramPoll = delivery.platform === 'instagram' && delivery.phase === 'poll';
    const exhaustedPolls = instagramPoll && delivery.providerState.polls >= 5;
    const retry = !uncertain && !error.auth && !exhaustedPolls && (error.retryable === true || (!error.rejected && error.retryable !== false)) && delivery.attempts < 20;
    const status = uncertain ? 'uncertain' : retry ? 'processing' : 'failed';
    const values = { status, reason: uncertain ? 'publish_outcome_unknown' : error.auth ? 'account_reconnect_required' : exhaustedPolls ? 'processing_timeout' : retry ? 'provider_retry' : 'provider_rejected',
      ...(retry ? { nextPollAt: new Date(now.getTime() + Math.max(instagramPoll ? 60_000 : 1000, Math.min(300_000, error.retryAfterMs || 30_000))) } : {}),
      ...(!uncertain && !retry ? { reserved: false } : {}) };
    await SocialDelivery.updateOne(where, { $set: values, ...(!uncertain ? { $unset: { publishStartedAt: 1 } } : {}) });
    if (error.auth) await SocialAccount.updateOne({ _id: account._id, revision: account.revision }, { $set: { status: 'reconnect' } });
  } finally {
    await SocialDelivery.updateOne(where, { $unset: { leaseToken: 1, leaseUntil: 1 } });
  }
  const result = await batchSummary(batch, now);
  await finishSocialBatch(batch, result);
  return result;
}

export async function maintainSocialPublishing({ now = new Date(), provider } = {}) {
  if (!provider && !process.env.SOCIAL_GITHUB_REPOSITORY_ID) return;
  await socialTransaction(session => expireDeliveries(now, session));
  const accounts = await SocialAccount.find({ status: 'ready', expiresAt: { $lte: new Date(now.getTime() + 7 * 86400_000) } }).select('+accessToken +refreshToken').lean();
  const reconcile = await SocialDelivery.find({ $and: [{ $or: [{ status: { $in: ['submitted', 'uncertain'] } }, { status: 'published', platform: 'instagram', permalink: { $in: [null, ''] } }] },
    { providerId: { $exists: true } }, { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] }] }).limit(4).select('+providerState').lean();
  if (!accounts.length && !reconcile.length) return;
  const impl = await defaultProvider(provider);
  for (const account of accounts) {
    if (account.expiresAt <= now) { await SocialAccount.updateOne({ _id: account._id, revision: account.revision }, { $set: { status: 'reconnect' } }); continue; }
    if (account._id === 'instagram' && now - (account.tokenIssuedAt || 0) < 86400_000) continue;
    const leased = await SocialAccount.findOneAndUpdate({ _id: account._id, revision: account.revision, $or: [{ refreshLeaseUntil: null }, { refreshLeaseUntil: { $lte: now } }] }, { $set: { refreshLeaseUntil: new Date(now.getTime() + 60_000) } });
    if (!leased) continue;
    try {
      const tokens = await impl.refresh(account);
      if (tokens) await SocialAccount.updateOne({ _id: account._id, revision: account.revision }, { $set: { accessToken: encryptSocialToken(tokens.accessToken), expiresAt: new Date(now.getTime() + tokens.expiresIn * 1000), tokenIssuedAt: now,
        ...(tokens.refreshToken ? { refreshToken: encryptSocialToken(tokens.refreshToken) } : {}) } });
    } catch (error) { if (error.auth) await SocialAccount.updateOne({ _id: account._id, revision: account.revision }, { $set: { status: 'reconnect' } }); }
    finally { await SocialAccount.updateOne({ _id: account._id, revision: account.revision }, { $unset: { refreshLeaseUntil: 1 } }); }
  }
  for (const delivery of reconcile) {
    const account = await SocialAccount.findById(delivery.platform).select('+accessToken +refreshToken').lean();
    if (!account || account.destination !== delivery.destination) continue;
    try {
      const receipt = await impl.receipt(delivery, account, delivery.providerId);
      if (receipt?.published) await SocialDelivery.updateOne({ _id: delivery._id, status: { $in: ['submitted', 'uncertain', 'published'] } }, { $set: { status: 'published', permalink: receipt.permalink || '', publishedAt: delivery.publishedAt || now, reason: '' } });
    } catch { /* Read-only reconciliation leaves unresolved outcomes quarantined. */ }
  }
}

export async function reconcileSocialDelivery(postId, id, body, admin, { now = new Date(), provider } = {}) {
  if (!mongoose.isObjectIdOrHexString(id) || !mongoose.isObjectIdOrHexString(postId)) throw socialError('Invalid delivery ID.');
  const delivery = await SocialDelivery.findOne({ _id: id, post: postId, status: 'uncertain' }).select('+providerState').lean();
  if (!delivery || delivery.leaseUntil > now) throw socialError('This delivery is not ready for reconciliation.', 409);
  let receipt;
  if (body.confirmation === 'CONFIRM_NOT_PUBLISHED') {
    if (delivery.batchDeadline > now) throw socialError('Wait until the batch deadline and check the platform before confirming absence.', 409);
  } else {
    if (typeof body.providerId !== 'string' || body.providerId.length > 200) throw socialError('Enter the provider post ID or explicitly confirm that no post exists.');
    const account = await SocialAccount.findById(delivery.platform).select('+accessToken +refreshToken').lean();
    if (!account || account.destination !== delivery.destination) throw socialError('Reconnect the original destination before reconciliation.', 409);
    receipt = await (await defaultProvider(provider)).receipt(delivery, account, body.providerId);
    if (!receipt?.published) throw socialError('The platform could not verify this post for the approved account and caption.', 409);
  }
  return socialTransaction(async session => {
    const update = receipt ? { $set: { status: 'published', phase: 'done', providerId: body.providerId, permalink: receipt.permalink || '', publishedAt: now, reason: 'verified_by_admin' } }
      : { $set: { status: 'failed', reserved: false, reason: 'absence_confirmed_by_admin' }, $unset: { publishStartedAt: 1 } };
    const changed = await SocialDelivery.findOneAndUpdate({ _id: id, post: postId, status: 'uncertain' }, update, { session, new: true });
    if (!changed) throw socialError('This delivery changed. Refresh its history.', 409);
    await socialAudit(admin, receipt ? 'social_delivery_verified' : 'social_delivery_absence_confirmed', 'SocialDelivery', changed._id, session, delivery.platform);
    return publicSocialDelivery(changed);
  });
}
