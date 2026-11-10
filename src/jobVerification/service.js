import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Report from '../models/JobVerification.js';
import Lease from '../models/JobVerificationLease.js';
import Queue from '../models/JobVerificationQueue.js';
import User from '../models/User.js';
import { MongoRateLimitStore } from '../utils/mongoRateLimitStore.js';
import { investigateJob, summarizeReport } from './engine.js';
import { normalizeJobUrl, redactText } from './urls.js';
import { findVerificationCandidates } from './repository.js';
import { sourceChecks } from './sources.js';

export const verificationEnabled = () => process.env.JOB_VERIFICATION_ENABLED === 'true';
const DAY = 86_400_000;
const error = (status, code, message) => Object.assign(new Error(message), { status, code });
const validId = value => mongoose.isObjectIdOrHexString(value);
const safeId = value => { if (!validId(value)) throw error(404, 'report_not_found', 'Report not found.'); return value; };
const resultOf = item => ({ ...item.report, id: String(item._id), status: item.status === 'admitting' ? 'queued' : item.status, phase: item.phase, submittedUrl: item.input.url,
  context: { company: item.input.company || '', title: item.input.title || '' }, createdAt: item.createdAt, expiresAt: item.expiresAt,
  ...(item.error ? { error: item.error } : {}) });

export function createVerificationService({ enabled = verificationEnabled, engine = investigateJob, prepareSources = sourceChecks.prepareSources, now = () => new Date(), deadlineMs = 60_000 } = {}) {
  const daily = new MongoRateLimitStore({ prefix: 'job-verification-day', windowMs: DAY, now: () => now().getTime() });
  const active = new Map();
  let stopping = false, inFlightTick;
  const owned = (owner, id) => ({ _id: safeId(id), owner, expiresAt: { $gt: now() } });
  const releasePending = id => Queue.updateOne({ _id: 'pending' }, { $pull: { reportIds: String(id) } });
  const requireAccount = async owner => {
    if (!await User.exists({ _id: owner, accountDeletingAt: null })) throw error(403, 'account_unavailable', 'This account is no longer available for new checks.');
  };
  async function submit(owner, body) {
    if (!enabled()) throw error(503, 'verification_disabled', 'Job verification is not enabled yet.');
    if (!body || typeof body !== 'object' || Object.keys(body).some(key => !['url', 'company', 'title'].includes(key))) throw error(400, 'invalid_input', 'Provide a job URL and optional company and title.');
    const url = normalizeJobUrl(body.url);
    for (const key of ['company', 'title']) if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > 200)) throw error(400, 'invalid_context', 'Company and title must be text of at most 200 characters.');
    await requireAccount(owner);
    let item;
    try {
      item = await Report.create({ owner, activeOwner: String(owner), status: 'admitting', leaseUntil: new Date(now().getTime() + 60_000), input: { url, company: redactText(body.company, 200), title: redactText(body.title, 200) }, expiresAt: new Date(now().getTime() + 30 * DAY) });
    } catch (failure) {
      if (failure.code === 11000) throw error(409, 'verification_active', 'You already have a verification in progress. Open it from recent checks.');
      throw failure;
    }
    let charged = false;
    try {
      const usage = await daily.increment(String(owner));
      charged = true;
      if (usage.totalHits > 20) throw error(429, 'daily_limit', 'You have used today’s 20 new checks. Your existing reports are still available.');
      try {
        await Queue.findOneAndUpdate({ _id: 'pending', 'reportIds.99': { $exists: false } }, { $push: { reportIds: String(item._id) } }, { upsert: true, new: true });
      } catch (failure) {
        if (failure.code === 11000) throw error(503, 'queue_full', 'Verification is busy right now. Please try again shortly; this attempt does not use a daily check.');
        throw failure;
      }
      // Deletion marks the account before sweeping reports. This second check
      // also catches a report created after that sweep by an in-flight request.
      await requireAccount(owner);
      const published = await Report.updateOne({ _id: item._id, status: 'admitting' }, { $set: { status: 'queued' }, $unset: { leaseUntil: 1 } });
      if (!published.matchedCount) throw error(409, 'verification_cancelled', 'This verification was cancelled.');
      item.status = 'queued';
    } catch (failure) {
      await Report.deleteOne({ _id: item._id });
      await releasePending(item._id);
      if (charged) await daily.decrement(String(owner));
      throw failure;
    }
    return resultOf(item.toObject());
  }
  async function get(owner, id) {
    const item = await Report.findOne(owned(owner, id)).lean();
    if (!item) throw error(404, 'report_not_found', 'Report not found.');
    return resultOf(item);
  }
  async function list(owner, { page = 1 } = {}) {
    page = Number(page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) throw error(400, 'invalid_page', 'Choose a valid history page.');
    const filter = { owner, expiresAt: { $gt: now() } };
    const [items, total] = await Promise.all([Report.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean(), Report.countDocuments(filter)]);
    return { items: items.map(resultOf), pagination: { page, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) } };
  }
  async function remove(owner, id) {
    const result = await Report.deleteOne(owned(owner, id));
    if (!result.deletedCount) throw error(404, 'report_not_found', 'Report not found.');
    active.get(String(id))?.abort();
    await releasePending(id);
  }
  async function recover() {
    const interruptedAdmissions = await Report.find({ status: 'admitting', leaseUntil: { $lte: now() } }).select('_id').limit(100).lean();
    for (const item of interruptedAdmissions) {
      await Report.updateOne({ _id: item._id, status: 'admitting' }, { $set: { status: 'failed', phase: 'completed', error: 'Submission was interrupted. Please check this link again.' }, $unset: { activeOwner: 1, leaseUntil: 1 } });
      await releasePending(item._id);
    }
    const queue = await Queue.findById('pending').lean();
    if (queue?.reportIds.length) {
      const pending = await Report.find({ _id: { $in: queue.reportIds }, status: { $in: ['queued', 'admitting'] }, expiresAt: { $gt: now() } }).select('_id').lean();
      const liveIds = new Set(pending.map(item => String(item._id)));
      const orphaned = queue.reportIds.filter(id => !liveIds.has(id));
      if (orphaned.length) await Queue.updateOne({ _id: 'pending' }, { $pull: { reportIds: { $in: orphaned } } });
    }
    const stale = await Report.find({ status: 'running', leaseUntil: { $lte: now() } }).limit(20).lean();
    for (const item of stale) {
      const evidence = [...(item.report?.evidence || []), { id: 'interrupted', phase: 'risk', title: 'Investigation interrupted', status: 'unavailable', outcome: 'neutral',
        detail: 'The worker stopped before completing this investigation. Completed evidence is retained; check again for current results.', sourceUrl: item.input.url, observedAt: now().toISOString() }];
      const report = summarizeReport({ ...item.report, sourceStatus: item.report?.sourceStatus || 'unconfirmed', availability: item.report?.availability || 'unknown', evidence });
      await Report.updateOne({ _id: item._id, status: 'running', runToken: item.runToken }, { $set: { status: 'completed', phase: 'completed', report, completedAt: now() }, $unset: { activeOwner: 1, runToken: 1, leaseUntil: 1 } });
      await releasePending(item._id);
    }
  }
  async function slot(index) {
    if (stopping) return;
    const token = randomUUID();
    const leaseUntil = new Date(now().getTime() + deadlineMs + 10_000);
    try {
      await Lease.findOneAndUpdate({ _id: `job-verification-${index}`, leaseUntil: { $lte: now() } }, { $set: { token, leaseUntil } }, { upsert: true, new: true });
    } catch (failure) { if (failure.code === 11000) return; throw failure; }
    let item, timer;
    const controller = new AbortController();
    try {
      item = await Report.findOneAndUpdate({ status: 'queued', expiresAt: { $gt: now() } }, { $set: { status: 'running', phase: 'destination', runToken: token, leaseUntil, startedAt: now() } }, { sort: { createdAt: 1 }, new: true }).lean();
      if (!item) return;
      await releasePending(item._id);
      active.set(String(item._id), controller);
      const filter = { _id: item._id, status: 'running', runToken: token };
      let latest = { evidence: [], sourceStatus: 'unconfirmed', availability: 'unknown' };
      const onProgress = async report => {
        controller.signal.throwIfAborted(); latest = report;
        const saved = await Report.updateOne(filter, { $set: { report, phase: report.phase } });
        if (!saved.matchedCount) { controller.abort(); throw error(409, 'run_released', 'This investigation is no longer active.'); }
      };
      const work = Promise.resolve().then(() => engine(item.input, { signal: controller.signal, now, prepareSources, findCandidates: findVerificationCandidates, checkRisk: sourceChecks.checkRisk, onProgress }));
      work.catch(() => {});
      const deadline = new Promise(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(null); }, deadlineMs);
      });
      const result = await Promise.race([work, deadline]);
      if (!result) latest = summarizeReport({ ...latest, evidence: [...latest.evidence, { id: 'deadline', phase: 'risk', title: 'Check deadline', status: 'unavailable', outcome: 'neutral',
        detail: 'The 60-second investigation deadline was reached. Completed evidence is retained.', sourceUrl: item.input.url, observedAt: now().toISOString() }] });
      await Report.updateOne(filter, { $set: { status: 'completed', phase: 'completed', report: result || latest, completedAt: now() }, $unset: { activeOwner: 1, runToken: 1, leaseUntil: 1 } });
      if (process.env.NODE_ENV === 'production') console.info('[Job verification]', JSON.stringify({ event: 'completed', verdict: (result || latest).verdict,
        durationMs: Math.max(0, now().getTime() - new Date(item.startedAt).getTime()), unavailableChecks: (result || latest).evidence?.filter(value => value.status === 'unavailable').length || 0 }));
    } catch {
      if (item) await Report.updateOne({ _id: item._id, runToken: token, status: 'running' }, { $set: { status: 'failed', phase: 'completed', error: 'The investigation could not finish. Completed evidence is retained; please try again.', completedAt: now() }, $unset: { activeOwner: 1, runToken: 1, leaseUntil: 1 } });
    } finally {
      clearTimeout(timer);
      if (item) active.delete(String(item._id));
      await Lease.updateOne({ _id: `job-verification-${index}`, token }, { $set: { leaseUntil: new Date(0) }, $unset: { token: 1 } });
    }
  }
  async function tick() {
    if (!enabled() || inFlightTick || stopping) return inFlightTick;
    inFlightTick = (async () => { await recover(); if (enabled()) await Promise.all([slot(0), slot(1)]); })().finally(() => { inFlightTick = undefined; });
    return inFlightTick;
  }
  async function stop() { stopping = true; for (const controller of active.values()) controller.abort(); await inFlightTick; }
  return { submit, get, list, remove, tick, stop };
}
export const verificationService = createVerificationService();
