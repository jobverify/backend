import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import Job from '../models/Job.js';
import SocialPost from '../models/SocialPost.js';
import { canProcessClassifiedJobAlerts } from '../services/jobAlertClassificationGate.js';
import { defaultSocialCaptions, factsDigest, socialError } from './policy.js';
import { matchesVideoPreferences, videoPlan, VIDEO_FAILURES, VIDEO_LEASE_MS } from './videoPolicy.js';
import { eligibleSocialJob, socialTransaction, publicSocialPost, socialAudit } from './service.js';

export const publicVideoPost = publicSocialPost;
const id = value => { if (!mongoose.isObjectIdOrHexString(value)) throw socialError('Invalid social post ID.'); return value; };
const validRevision = value => { if (!Number.isInteger(value) || value < 0) throw socialError('A valid revision is required.'); };
const queryPost = (postId, session) => SocialPost.findById(id(postId)).session(session);
function checkLease(post, input, now, checkRevision = false) {
  const g = post?.generation;
  if (!post || post.origin !== 'instagram_auto' || post.status === 'cancelled' || g?.state !== 'rendering' || typeof input.leaseToken !== 'string'
    || g.leaseToken !== input.leaseToken || g.renderId !== input.renderId || new Date(g.leaseUntil) <= now
    || (checkRevision && (input.revision !== post.revision || input.revision !== g.sourceRevision))) throw socialError('Stale or expired video lease. Claim current work again.', 409);
}
const resetGeneration = (post, state = 'queued') => ({ state, attempts: 0, runIds: post.generation?.runIds || [], selection: post.generation?.selection });
async function currentCandidate(post, prefs, now, session) {
  const job = await eligibleSocialJob(String(post.job), now, session);
  if (!job || job.fingerprint !== post.fingerprint) return null;
  const row = await Job.findById(post.job).session(session).lean();
  return row && matchesVideoPreferences(row, prefs, now) ? job : null;
}
async function findNewJob(prefs, now, session) {
  // Do not limit the initial forty public jobs before applying preferences.
  // Stable keyset pages bound memory while retaining the saved-filter matcher.
  let cursor;
  for (let page = 0; page < 100; page++) {
    const rows = await Job.find({ status: 'active', ...(cursor ? { $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }] } : {}) })
      .sort({ createdAt: -1, _id: -1 }).limit(100).session(session).lean();
    for (const row of rows) {
      if (!matchesVideoPreferences(row, prefs, now) || !row.fingerprint || await SocialPost.exists({ fingerprint: row.fingerprint }).session(session)) continue;
      const job = await eligibleSocialJob(String(row._id), now, session);
      if (job) return { row, job };
    }
    if (rows.length < 100) return null;
    cursor = rows.at(-1);
  }
  return null;
}
export async function claimVideoDraft({ runId = '', now = new Date() } = {}) {
  if (!/^\d+$/.test(String(runId))) throw socialError('A trusted workflow run is required.');
  if (!await canProcessClassifiedJobAlerts()) return { done: true, reason: 'classification_not_ready' };
  return socialTransaction(async (session, settings) => {
    const prefs = settings.instagramDrafts;
    if (!prefs?.enabled || !prefs.configuredBy) return { done: true, reason: 'disabled' };
    settings.instagramDrafts = { ...prefs, lastRunAt: now, lastRunOutcome: 'no_work' };
    if (await SocialPost.countDocuments({ 'generation.runIds': String(runId) }).session(session) >= 2) return { done: true, reason: 'run_limit' };
    const rows = await SocialPost.find({ origin: 'instagram_auto', approvalHash: null, status: { $in: ['draft', 'needs_review'] } }).sort({ createdAt: 1 }).session(session);
    let candidate; let count = 0;
    for (const post of rows) {
      const g = post.generation || {};
      const current = await currentCandidate(post, prefs, now, session);
      if (!current) continue;
      if (g.state === 'rendering' && new Date(g.leaseUntil) <= now && g.attempts >= 3) {
        post.generation = { ...g, state: 'failed', retryable: false, reason: 'timeout', leaseToken: undefined, uploads: {} }; await post.save({ session }); continue;
      }
      if (['queued', 'rendering', 'ready'].includes(g.state) && (g.state !== 'ready' || post.video?.factsHash === current.factsHash && post.video?.mp4?.hash && post.video?.cover?.hash && post.video?.subtitles?.hash)) count++;
      const retry = g.state === 'failed' && g.retryable && g.attempts < 3 && new Date(g.nextAttemptAt) <= now;
      const available = g.state === 'queued' || retry || g.state === 'rendering' && new Date(g.leaseUntil) <= now;
      if (!candidate && available && !(g.runIds || []).includes(String(runId))) candidate = { post, current };
    }
    if (candidate?.post.generation?.state === 'failed' && count >= 4) candidate = null;
    if (!candidate && count < 4) {
      const found = await findNewJob(prefs, now, session);
      if (found) {
        const [post] = await SocialPost.create([{ job: found.row._id, ...found.job, origin: 'instagram_auto', instagramMediaType: 'reel', createdBy: prefs.configuredBy,
          captions: defaultSocialCaptions(found.job.facts, process.env.FRONTEND_ORIGIN || 'https://www.jobverify.in'),
          generation: { state: 'queued', attempts: 0, runIds: [], selection: { filters: prefs.filters, matchAll: prefs.matchAll, configuredAt: prefs.configuredAt } } }], { session });
        candidate = { post, current: found.job };
      }
    }
    if (!candidate) return { done: true, reason: count >= 4 ? 'target_met' : 'no_work' };
    const { post, current } = candidate;
    if (post.factsHash !== current.factsHash) {
      Object.assign(post, current, { video: null, captions: defaultSocialCaptions(current.facts) }); post.revision++;
    }
    const branding = await Job.findById(post.job).select('companyDomain').session(session).lean();
    const plan = videoPlan(post.facts, branding || {}); const planHash = factsDigest(plan);
    post.generation = { ...post.generation, state: 'rendering', attempts: (post.generation?.attempts || 0) + 1, renderId: randomUUID(), leaseToken: randomUUID(),
      leaseUntil: new Date(+now + VIDEO_LEASE_MS), runId: String(runId), runIds: [...(post.generation?.runIds || []), String(runId)], sourceRevision: post.revision,
      factsHash: post.factsHash, plan, planHash, uploads: {}, reason: '', retryable: false, nextAttemptAt: null, completionDigest: null };
    await post.save({ session }); settings.instagramDrafts.lastRunOutcome = 'claimed'; settings.markModified('instagramDrafts');
    const g = post.generation;
    return { done: false, claim: { postId: String(post._id), renderId: g.renderId, leaseToken: g.leaseToken, leaseUntil: g.leaseUntil, revision: post.revision, facts: post.facts, factsHash: post.factsHash, plan, planHash } };
  });
}
export async function heartbeatVideoDraft(input, { now = new Date() } = {}) {
  return socialTransaction(async session => {
    const post = await queryPost(input.postId, session); checkLease(post, input, now);
    post.generation = { ...post.generation, leaseUntil: new Date(+now + VIDEO_LEASE_MS) }; await post.save({ session });
    return { leaseUntil: post.generation.leaseUntil };
  });
}
export async function recordVideoUpload(input, asset, { now = new Date(), put } = {}) {
  validRevision(input.revision);
  // Check before object storage and again when attaching the upload. A cancelled
  // upload can leave an unreferenced content-addressed object, never ready media.
  const post = await queryPost(input.postId, null); checkLease(post, input, now, true);
  await put();
  return socialTransaction(async session => {
    const current = await queryPost(input.postId, session); checkLease(current, input, new Date(Math.max(+now, Date.now())), true);
    current.generation = { ...current.generation, uploads: { ...current.generation.uploads, [input.kind]: asset } }; await current.save({ session }); return asset;
  });
}
export async function completeVideoDraft(input, { now = new Date() } = {}) {
  validRevision(input.revision);
  const digest = factsDigest({ renderId: input.renderId, leaseToken: input.leaseToken, revision: input.revision, factsHash: input.factsHash, planHash: input.planHash, artifacts: input.artifacts, versions: input.versions });
  return socialTransaction(async (session, settings) => {
    const post = await queryPost(input.postId, session);
    if (post?.generation?.state === 'ready' && post.generation.completionDigest === digest) return publicSocialPost(post);
    checkLease(post, input, now, true); const g = post.generation;
    if (input.factsHash !== post.factsHash || input.planHash !== g.planHash || factsDigest(g.plan) !== input.planHash) throw socialError('Rendering facts or plan changed.', 409);
    const current = await eligibleSocialJob(String(post.job), now, session);
    if (!current || current.fingerprint !== post.fingerprint || current.factsHash !== input.factsHash) throw socialError('Job facts changed or are no longer eligible. Refresh the draft.', 409);
    const branding = await Job.findById(post.job).select('companyDomain').session(session).lean();
    if (g.plan.companyDomain !== videoPlan(current.facts, branding || {}).companyDomain) throw socialError('Employer branding changed. Refresh the draft.', 409);
    if (!input.artifacts || ['video', 'cover', 'subtitles'].some(kind => !g.uploads?.[kind]?.hash || g.uploads[kind].hash !== input.artifacts[kind])) throw socialError('All validated artifacts must be uploaded by the current lease.', 409);
    if (!input.versions || typeof input.versions !== 'object' || Array.isArray(input.versions) || JSON.stringify(input.versions).length > 2000
      || Object.entries(input.versions).some(([key, value]) => key.length > 80 || typeof value !== 'string' || value.length > 200)) throw socialError('Provide bounded renderer versions.');
    post.video = { mp4: g.uploads.video, cover: g.uploads.cover, subtitles: g.uploads.subtitles, script: g.plan.script, templateVersion: g.plan.templateVersion, planHash: g.planHash, factsHash: post.factsHash };
    post.generation = { ...g, state: 'ready', completedAt: now, versions: input.versions, completionDigest: digest, uploads: {}, leaseUntil: null };
    settings.instagramDrafts = { ...settings.instagramDrafts, lastRunOutcome: 'ready' };
    post.status = 'draft'; post.revision++; await post.save({ session }); return publicSocialPost(post);
  });
}
export async function failVideoDraft(input, { now = new Date() } = {}) {
  if (!VIDEO_FAILURES.includes(input.reason) || typeof input.retryable !== 'boolean') throw socialError('Invalid video failure reason.');
  return socialTransaction(async (session, settings) => {
    const post = await queryPost(input.postId, session); checkLease(post, input, now);
    const retryable = input.retryable && post.generation.attempts < 3;
    post.generation = { ...post.generation, state: 'failed', reason: input.reason, retryable, failedAt: now,
      nextAttemptAt: retryable ? new Date(+now + 5 * 60_000 * 2 ** (post.generation.attempts - 1)) : null, leaseToken: undefined, leaseUntil: null, uploads: {} };
    settings.instagramDrafts = { ...settings.instagramDrafts, lastRunOutcome: 'failed' };
    await post.save({ session }); return publicSocialPost(post);
  });
}
export async function retryVideoDraft(postId, revision, admin, { now = new Date() } = {}) {
  validRevision(revision);
  return socialTransaction(async session => {
    const post = await queryPost(postId, session);
    if (!post || post.origin !== 'instagram_auto' || post.revision !== revision || post.approvalHash || !['failed', 'cancelled'].includes(post.generation?.state)) throw socialError('This video changed or is not ready for retry.', 409);
    const current = await eligibleSocialJob(String(post.job), now, session); if (!current || current.fingerprint !== post.fingerprint) throw socialError('Job is no longer eligible.', 409);
    Object.assign(post, current, { video: null, status: 'draft', generation: resetGeneration(post), captions: defaultSocialCaptions(current.facts) }); post.revision++;
    await post.save({ session }); await socialAudit(admin, 'social_video_retry', 'SocialPost', post._id, session); return publicSocialPost(post);
  });
}
