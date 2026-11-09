import { randomUUID } from 'node:crypto';
import Application, { APPLICATION_STAGES } from '../models/Application.js';
import ApplicationEvent from '../models/ApplicationEvent.js';
import Job from '../models/Job.js';
import TailoredResume from '../models/TailoredResume.js';
import User from '../models/User.js';

const failure = (statusCode, message) => Object.assign(new Error(message), { statusCode });
export const applicationStage = application => application.stage || (application.status === 'applied' ? 'applied' : 'preparing');
export const publicApplication = application => application ? { ...application, stage: applicationStage(application), version: application.version ?? 0 } : null;

async function fenceOwner(user, session) {
  // Write the same user row that account deletion marks before removing data.
  // Snapshot isolation alone would permit a late request to recreate history.
  const owner = await User.updateOne({ _id: user, deactivated: { $ne: true }, accountDeletingAt: null }, { $inc: { __v: 1 } }, { session });
  if (owner.matchedCount !== 1) throw failure(404, 'Candidate account is no longer active.');
}

// Transactions are required: losing a timeline event must never silently leave
// its corresponding application state committed. No standalone fallback exists.
async function transaction(action, { session } = {}) {
  if (session) {
    if (!session.inTransaction()) throw new Error('An active application transaction is required.');
    return action(session);
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const ownSession = await Application.db.startSession();
    try { return await ownSession.withTransaction(() => action(ownSession)); }
    catch (error) { if (error.code !== 11000 || attempt === 2) throw error; }
    finally { await ownSession.endSession(); }
  }
}

function snapshot(job) {
  return {
    title: String(job.title ?? '').slice(0, 1000), company: String(job.company ?? '').slice(0, 500),
    location: String(job.location || job.city || '').slice(0, 2000), jobType: String(job.jobType ?? '').slice(0, 100),
    applicationUrl: safeApplicationUrl(job).slice(0, 8192),
  };
}

async function append(application, event, session) {
  await ApplicationEvent.create([{ application: application._id, user: application.user, version: application.version ?? 0, ...event }], { session });
}

export function safeApplicationUrl(job) {
  for (const value of [job.applicationUrl, job.applyUrl, job.sourceUrl]) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch { /* Try the validated public-job fallback. */ }
  }
  return '';
}

export async function recordApplicationOpen(user, job, now = new Date(), options = {}) {
  const key = `open:${options.eventKey || randomUUID()}`;
  return transaction(async session => {
    await fenceOwner(user, session);
    let application = await Application.findOne({ user, job: job._id }).session(session).lean();
    const priorStage = application ? applicationStage(application) : '';
    if (application) {
      if (await ApplicationEvent.exists({ application: application._id, user, key }).session(session)) return publicApplication(application);
      application = await Application.findOneAndUpdate({ _id: application._id, user }, {
        $set: { lastOpenedAt: now, firstOpenedAt: application.firstOpenedAt || now, stage: priorStage }, $inc: { version: 1 },
      }, { new: true, session, runValidators: true }).lean();
    } else {
      const [created] = await Application.create([{ user, job: job._id, jobSnapshot: snapshot(job), status: 'opened', stage: 'preparing',
        version: 1, timelineStartedAt: now, firstOpenedAt: now, lastOpenedAt: now }], { session });
      application = created.toObject();
    }
    await append(application, { key, kind: 'opened', actor: 'candidate', actorUser: user, source: 'employer_link', occurredAt: now,
      priorStage, newStage: applicationStage(application) }, session);
    return publicApplication(application);
  }, options);
}

// Source and actor are chosen by trusted server-side observers, never HTTP input.
export async function recordApplicationEvidence(user, applicationId, input, options = {}) {
  if (!['self_reported', 'email', 'auto_apply'].includes(input.source)
    || typeof input.key !== 'string' || !input.key || input.key.length > 300
    || !(input.observedAt instanceof Date) || !Number.isFinite(input.observedAt.getTime())) throw new Error('Invalid application evidence.');
  const evidence = { key: input.key, source: input.source, observedAt: input.observedAt,
    summary: String(input.summary || '').slice(0, 500), reference: String(input.reference || '').slice(0, 300) };
  const key = `evidence:${evidence.key}`;
  return transaction(async session => {
    await fenceOwner(user, session);
    const application = await Application.findOne({ _id: applicationId, user }).session(session).lean();
    if (!application) return null;
    // Retain deduplication of legacy evidence and use the unbounded event log for
    // new evidence after it has aged out of the twenty-entry presentation array.
    if (application.evidence?.some(row => row.key === evidence.key)
      || await ApplicationEvent.exists({ application: applicationId, user, key }).session(session)) return publicApplication(application);
    const priorStage = applicationStage(application);
    const stage = priorStage === 'preparing' ? 'applied' : priorStage;
    const updated = await Application.findOneAndUpdate({ _id: applicationId, user }, { $set: {
      status: 'applied', stage, appliedAt: application.appliedAt || evidence.observedAt,
      confirmationSource: ['', 'self_reported'].includes(application.confirmationSource || '') ? evidence.source : application.confirmationSource,
      evidence: [...(application.evidence || []), evidence].slice(-20),
    }, $inc: { version: 1 } }, { new: true, session, runValidators: true }).lean();
    await append(updated, { key, kind: 'submission_confirmed', source: evidence.source,
      actor: evidence.source === 'self_reported' ? 'candidate' : 'system', actorUser: evidence.source === 'self_reported' ? user : null,
      occurredAt: evidence.observedAt, priorStage, newStage: stage, note: evidence.summary, reference: evidence.reference }, session);
    return publicApplication(updated);
  }, options);
}

function validateStageInput(input) {
  if (!input || Object.keys(input).some(key => !['stage', 'expectedVersion', 'eventKey', 'note'].includes(key))
    || !APPLICATION_STAGES.includes(input.stage)
    || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
    || typeof input.eventKey !== 'string' || !/^[a-zA-Z0-9:_-]{1,200}$/.test(input.eventKey)
    || (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 2000))) {
    throw failure(400, 'Choose a valid stage, version, event key and a note of at most 2000 characters.');
  }
}

async function changeStage(user, application, input, session) {
  if (!application) throw failure(404, 'Application not found.');
  const key = `stage:${input.eventKey}`;
  const note = (input.note || '').trim();
  const prior = await ApplicationEvent.findOne({ application: application._id, user, key }).session(session).lean();
  if (prior) {
    if (prior.newStage !== input.stage || prior.note !== note || prior.expectedVersion !== input.expectedVersion) throw failure(409, 'This update key was already used. Reload the application before saving again.');
    return publicApplication(application);
  }
  if ((application.version ?? 0) !== input.expectedVersion) throw failure(409, 'This application changed while you were editing. Reload its latest stage and try again.');
  const priorStage = applicationStage(application);
  const updated = await Application.findOneAndUpdate({ _id: application._id, user }, {
    $set: { stage: input.stage }, $inc: { version: 1 },
  }, { new: true, session, runValidators: true }).lean();
  await append(updated, { key, kind: 'stage_changed', actor: 'candidate', actorUser: user, source: 'candidate', occurredAt: new Date(),
    priorStage, newStage: input.stage, note, expectedVersion: input.expectedVersion }, session);
  return publicApplication(updated);
}

export async function changeApplicationStage(user, applicationId, input, options = {}) {
  validateStageInput(input);
  return transaction(async session => {
    await fenceOwner(user, session);
    return changeStage(user, await Application.findOne({ _id: applicationId, user }).session(session).lean(), input, session);
  }, options);
}

export async function changeJobApplicationStage(user, jobId, input, options = {}) {
  validateStageInput(input);
  return transaction(async session => {
    await fenceOwner(user, session);
    let application = await Application.findOne({ job: jobId, user }).session(session).lean();
    if (!application) {
      const resume = await TailoredResume.exists({ job: jobId, user }).session(session);
      const listing = resume && await Job.findById(jobId).session(session).lean();
      if (!listing) throw failure(404, 'Tracked resume or job not found.');
      if (input.expectedVersion !== 0) throw failure(409, 'This application changed. Reload its latest stage and try again.');
      const now = new Date();
      const [created] = await Application.create([{ user, job: jobId, jobSnapshot: snapshot(listing), status: 'opened', stage: 'preparing',
        version: 0, firstOpenedAt: null, lastOpenedAt: null, timelineStartedAt: now }], { session });
      application = created.toObject();
      await append(application, { key: 'tracking:started', kind: 'tracking_started', actor: 'candidate', actorUser: user, source: 'candidate',
        occurredAt: now, priorStage: '', newStage: 'preparing' }, session);
    }
    return changeStage(user, application, input, session);
  }, options);
}

export async function getApplicationTimeline(user, applicationId, { page = 1 } = {}) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw failure(400, 'Invalid timeline page.');
  const application = await Application.findOne({ _id: applicationId, user }).lean();
  if (!application) throw failure(404, 'Application not found.');
  const filter = { application: applicationId, user };
  const total = await ApplicationEvent.countDocuments(filter);
  const data = await ApplicationEvent.find(filter).sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * 20).limit(20).lean();
  return { application: publicApplication(application), data, legacyHistory: !application.timelineStartedAt,
    pagination: { page, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) } };
}
