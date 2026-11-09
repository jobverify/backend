import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import CVRevision from '../models/CVRevision.js';
import ResumeArtifact from '../models/ResumeArtifact.js';
import Resume from '../models/Resume.js';
import TailoredResume from '../models/TailoredResume.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import SiteSettings from '../models/SiteSettings.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';
import { artifactBytes, createResumeArtifact, readResumeArtifact } from './resumeArtifactService.js';
import { tailoringError } from './resumeTailoringContent.js';
import { resumeJobHash } from './resumeLatexContent.js';
import { getCandidateEvidenceSnapshot, lockCandidateEvidenceSnapshot } from './candidateEvidenceService.js';

const conflict = () => tailoringError('Your CV, source, or candidate evidence changed. Reload history and generate a current version before restoring.', 409);
const transaction = (session, callback) => session ? callback(session) : mongoose.connection.transaction(callback);
function scopeFor(user, { kind, jobId } = {}) {
  if (!['base', 'tailored'].includes(kind) || (kind === 'tailored' && !/^[a-f0-9]{24}$/i.test(String(jobId || '')))) throw tailoringError('Invalid CV history scope.', 400);
  return { user: user._id, kind, ...(kind === 'tailored' ? { job: jobId } : {}) };
}
const currentModel = scope => scope.kind === 'base' ? Resume : TailoredResume;
const currentFilter = scope => ({ _id: scope.kind === 'base' ? scope.user : `${scope.user}:${scope.job}`, user: scope.user });
const currentGeneration = (scope, row) => scope.kind === 'base' ? row?.preparation?.generationId : row?.generationId;
const currentStatus = (scope, row) => scope.kind === 'base' ? row?.preparation?.status : row?.status;
const metadata = revision => ({ id: revision._id, kind: revision.kind, jobId: revision.job ? String(revision.job) : null,
  sequence: revision.sequence, generationId: revision.generationId || null, actor: String(revision.actor), reason: revision.reason,
  restoredFrom: revision.restoredFrom || null, createdAt: revision.createdAt, pageCount: revision.pageCount || null,
  modelVersion: revision.modelVersion || '', styleVersion: revision.styleVersion || '', legacy: !revision.generationId,
  evidenceVersion: revision.evidenceSnapshot?.version ?? null, filename: revision.sourceSnapshot?.filename || 'resume' });

async function lockOwner(userId, session) {
  const owner = await User.findOneAndUpdate({ _id: userId, deactivated: { $ne: true }, accountDeletingAt: null }, { $inc: { __v: 1 } }, { session, new: true }).select('savedJobs').lean();
  if (!owner) throw tailoringError('This account is unavailable.', 409);
  return owner;
}

export async function removeCvDocuments(user, { session: suppliedSession } = {}) {
  return transaction(suppliedSession, async session => {
    await lockOwner(user._id, session);
    // Publication shares this owner fence. A new upload can only publish wholly
    // before removal, or after the entire removal commits.
    for (const Model of [Resume, TailoredResume, CVRevision, ResumeArtifact]) await Model.deleteMany({ user: user._id }).session(session);
  });
}

function sourceSnapshot(resume, document, row, job) {
  return { filename: resume?.filename || 'resume', extension: resume?.extension, mimeType: resume?.mimeType,
    size: resume?.size, uploadedAt: resume?.uploadedAt, sha256: row?.sourceResumeSha || resume?.sha256,
    text: document?.text || '', links: document?.links || [],
    ...(row?.job ? { jobId: String(row.job), jobHash: row.sourceJobHash, baseGenerationId: row.sourceBaseGenerationId, job: job || {} } : {}) };
}

// Existing current artifacts are adopted before the first history read or replacement.
async function adoptLegacy(scope, row, session) {
  if (!row || row.currentRevisionId) return row;
  const generationId = currentGeneration(scope, row);
  if (!generationId && !row.output) return row;
  const artifact = await readResumeArtifact(scope.user, generationId, { kind: scope.kind, job: scope.job, withSource: true, session });
  if (!artifact && !row.output) return row;
  const resume = scope.kind === 'base' ? row : await Resume.findOne({ _id: scope.user, user: scope.user }).session(session).lean();
  const publishedSource = { ...row, sourceResumeSha: artifact?.sourceResumeSha || row.outputResumeSha || resume?.sha256,
    sourceJobHash: artifact?.sourceJobHash || row.outputJobHash, sourceBaseGenerationId: artifact?.sourceBaseGenerationId || row.outputBaseGenerationId };
  const original = resume?.sha256 === publishedSource.sourceResumeSha ? resume : { filename: 'Earlier uploaded resume', sha256: publishedSource.sourceResumeSha };
  const history = await CVRevision.findOne(scope).sort({ sequence: -1 }).select('sequence').session(session).lean();
  const revision = (await CVRevision.create([{ _id: randomUUID(), ...scope, sequence: (history?.sequence || 0) + 1,
    generationId: artifact?._id, actor: scope.user, reason: 'legacy_import',
    sourceSnapshot: sourceSnapshot(original, { text: artifact?.facts?.sourceText }, scope.kind === 'tailored' ? publishedSource : null),
    evidenceSnapshot: { version: null, hash: null, experiences: [], achievements: [], skills: [] }, outputSnapshot: artifact ? undefined : row.output,
    pageCount: artifact?.pageCount, modelVersion: artifact?.modelVersion, styleVersion: artifact?.styleVersion,
    createdAt: row.generatedAt || row.preparation?.generatedAt || row.updatedAt || new Date(),
  }], { session }))[0];
  const changed = await currentModel(scope).updateOne({ ...currentFilter(scope), currentRevisionId: { $exists: false } },
    { $set: { currentRevisionId: revision._id, historyVersion: revision.sequence } }, { session });
  if (!changed.matchedCount) throw conflict();
  return { ...row, currentRevisionId: revision._id, historyVersion: revision.sequence };
}

export async function retainLegacyCv(user, input) {
  const scope = scopeFor(user, input);
  const existing = await currentModel(scope).findOne(currentFilter(scope)).lean();
  if (!existing || existing.currentRevisionId || (!currentGeneration(scope, existing) && !existing.output)) return;
  await transaction(null, async session => {
    await lockOwner(scope.user, session);
    await adoptLegacy(scope, await currentModel(scope).findOne(currentFilter(scope)).session(session).lean(), session);
  });
}

async function verifySources(scope, expected, evidence, session, owner) {
  const resume = await Resume.findOneAndUpdate({ _id: scope.user, user: scope.user }, { $inc: { historyFence: 1 } }, { session, new: true }).lean();
  if (!resume || resume.sha256 !== expected.sha256) throw conflict();
  const expectedEvidence = evidence?.version === null || evidence?.version === undefined ? await getCandidateEvidenceSnapshot(scope.user, { session }) : evidence;
  // Older saved CVs have no recorded evidence bank. They are restorable only
  // while the bank remains untouched, rather than silently asserting new facts.
  if ((evidence?.version === null || evidence?.version === undefined) && expectedEvidence.version !== 0) throw conflict();
  try { await lockCandidateEvidenceSnapshot(scope.user, expectedEvidence, { session }); }
  catch (error) { if (error.status === 409) throw conflict(); throw error; }
  if (scope.kind === 'tailored') {
    if (!owner.savedJobs?.some(id => String(id) === String(scope.job)) || resume.preparation?.generationId !== expected.baseGenerationId
      || ['queued', 'running'].includes(resume.preparation?.status)) throw conflict();
    const settings = await SiteSettings.findOne().session(session).lean();
    const job = await Job.findOneAndUpdate(applyPublicJobVisibility({ _id: scope.job, status: 'active' }, settings || {}), { $inc: { __v: 1 } }, { session, new: true }).lean();
    if (!job || resumeJobHash(job) !== expected.jobHash) throw conflict();
  }
  return resume;
}

export async function publishGeneratedCv({ kind, row, lease, output, source, document, evidence, jobSnapshot }, { session: suppliedSession } = {}) {
  const scope = scopeFor({ _id: row.user }, { kind, jobId: row.job });
  return transaction(suppliedSession, async session => {
    const owner = await lockOwner(scope.user, session);
    const snapshot = sourceSnapshot(source, document, kind === 'tailored' ? row : null, jobSnapshot);
    await verifySources(scope, snapshot, evidence, session, owner);
    let current = await currentModel(scope).findOne({ ...lease, ...(kind === 'base' ? { 'preparation.leaseUntil': { $gt: new Date() } } : { leaseUntil: { $gt: new Date() } }) }).session(session).lean();
    if (!current) throw conflict();
    current = await adoptLegacy(scope, current, session);
    const artifact = await createResumeArtifact({ user: scope.user, kind, ...(scope.job ? { job: scope.job } : {}), sourceResumeSha: snapshot.sha256,
      sourceJobHash: snapshot.jobHash, sourceBaseGenerationId: snapshot.baseGenerationId }, output, { session });
    const revision = (await CVRevision.create([{ _id: randomUUID(), ...scope, sequence: (current.historyVersion || 0) + 1,
      generationId: artifact._id, actor: scope.user, reason: 'generated', sourceSnapshot: snapshot, evidenceSnapshot: evidence,
      pageCount: artifact.pageCount, modelVersion: artifact.modelVersion, styleVersion: artifact.styleVersion,
    }], { session }))[0];
    const value = { status: 'completed', phase: 'completed', ready: false, error: '', generationId: artifact._id,
      outputResumeSha: snapshot.sha256, pageCount: artifact.pageCount, modelVersion: artifact.modelVersion, styleVersion: artifact.styleVersion,
      generatedAt: revision.createdAt, outputEvidenceVersion: evidence.version, outputEvidenceHash: evidence.hash };
    const outputValues = kind === 'base' ? Object.fromEntries(Object.entries(value).map(([key, val]) => [`preparation.${key}`, val]))
      : { ...value, outputFormat: 'latex-pdf', outputJobHash: snapshot.jobHash, outputBaseGenerationId: snapshot.baseGenerationId };
    const updated = await currentModel(scope).updateOne(lease, { $set: { ...outputValues, currentRevisionId: revision._id, historyVersion: revision.sequence },
      $unset: kind === 'base' ? { 'preparation.leaseOwner': 1, 'preparation.leaseUntil': 1 } : { leaseOwner: 1, leaseUntil: 1, output: 1 } }, { session });
    if (!updated.modifiedCount) throw conflict();
    return metadata(revision);
  });
}

export async function listCvRevisions(user, input, { before, limit = 20 } = {}) {
  const scope = scopeFor(user, input);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (before !== undefined && (!Number.isInteger(before) || before < 1))) throw tailoringError('Invalid history page.', 400);
  await retainLegacyCv(user, input);
  const rows = await CVRevision.find({ ...scope, ...(before ? { sequence: { $lt: before } } : {}) }).sort({ sequence: -1 }).limit(limit + 1)
    .select('kind job sequence generationId actor reason restoredFrom createdAt pageCount modelVersion styleVersion evidenceSnapshot.version sourceSnapshot.filename').lean();
  const current = await currentModel(scope).findOne(currentFilter(scope)).select('currentRevisionId').lean();
  return { currentRevisionId: current?.currentRevisionId || null, items: rows.slice(0, limit).map(metadata), nextBefore: rows.length > limit ? rows[limit - 1].sequence : null };
}

async function revisionById(user, input, id, session) {
  if (typeof id !== 'string' || id.length > 100) throw tailoringError('Invalid CV revision.', 400);
  const row = await CVRevision.findOne({ ...scopeFor(user, input), _id: id }).session(session || null).lean();
  if (!row) throw tailoringError('CV revision not found.', 404);
  return row;
}

export async function getCvRevisionArtifact(user, input, id) {
  const revision = await revisionById(user, input, id);
  const artifact = await readResumeArtifact(user._id, revision.generationId, { kind: input.kind, job: input.jobId, withSource: true });
  if (!artifact && !revision.outputSnapshot) throw tailoringError('This revision document is unavailable.', 404);
  return { revision, artifact };
}

export async function compareCvRevisions(user, input, { from, to }) {
  const detail = async id => {
    const { revision, artifact } = await getCvRevisionArtifact(user, input, id);
    return { ...metadata(revision), sourceSnapshot: revision.sourceSnapshot, evidenceSnapshot: revision.evidenceSnapshot,
      latex: artifact ? artifactBytes(artifact.latex).toString('utf8') : JSON.stringify(revision.outputSnapshot, null, 2), facts: artifact?.facts || null };
  };
  const [left, right] = await Promise.all([detail(from), detail(to)]);
  const changes = ['latex', 'sourceSnapshot', 'evidenceSnapshot', 'modelVersion', 'styleVersion', 'pageCount'].filter(field => JSON.stringify(left[field]) !== JSON.stringify(right[field])).map(field => ({ field }));
  return { from: left, to: right, changes };
}

export async function restoreCvRevision(user, input, id, { expectedCurrentRevisionId, session: suppliedSession } = {}) {
  if (typeof expectedCurrentRevisionId !== 'string' || !expectedCurrentRevisionId || expectedCurrentRevisionId.length > 100) throw tailoringError('Reload history before restoring a CV revision.', 409);
  const scope = scopeFor(user, input);
  return transaction(suppliedSession, async session => {
    const owner = await lockOwner(scope.user, session);
    const previous = await revisionById(user, input, id, session);
    const current = await currentModel(scope).findOne({ ...currentFilter(scope), currentRevisionId: expectedCurrentRevisionId }).session(session).lean();
    if (!current || ['queued', 'running'].includes(currentStatus(scope, current))) throw conflict();
    await verifySources(scope, previous.sourceSnapshot, previous.evidenceSnapshot, session, owner);
    const artifact = await readResumeArtifact(scope.user, previous.generationId, { kind: scope.kind, job: scope.job, session });
    if (!artifact) throw tailoringError('Regenerate this older CV format before restoring it.', 409);
    const revision = (await CVRevision.create([{ ...previous, _id: randomUUID(), sequence: (current.historyVersion || 0) + 1,
      actor: scope.user, reason: 'restored', restoredFrom: previous._id, createdAt: new Date(),
    }], { session }))[0];
    const value = { status: 'completed', phase: 'completed', ready: false, error: '', generationId: artifact._id, outputResumeSha: previous.sourceSnapshot.sha256,
      pageCount: artifact.pageCount, generatedAt: revision.createdAt, modelVersion: artifact.modelVersion, styleVersion: artifact.styleVersion,
      outputEvidenceVersion: previous.evidenceSnapshot.version, outputEvidenceHash: previous.evidenceSnapshot.hash };
    const values = scope.kind === 'base' ? Object.fromEntries(Object.entries(value).map(([key, val]) => [`preparation.${key}`, val]))
      : { ...value, outputFormat: 'latex-pdf', outputBaseGenerationId: previous.sourceSnapshot.baseGenerationId, outputJobHash: previous.sourceSnapshot.jobHash };
    const changed = await currentModel(scope).updateOne({ ...currentFilter(scope), currentRevisionId: expectedCurrentRevisionId }, {
      $set: { ...values, currentRevisionId: revision._id, historyVersion: revision.sequence },
      $inc: scope.kind === 'base' ? { 'preparation.revision': 1 } : { revision: 1 },
    }, { session });
    if (!changed.modifiedCount) throw conflict();
    return metadata(revision);
  });
}
