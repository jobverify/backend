import { randomUUID } from 'node:crypto';
import Resume from '../models/Resume.js';
import User from '../models/User.js';
import TailoredResume from '../models/TailoredResume.js';
import { artifactBytes, readResumeArtifact } from './resumeArtifactService.js';
import { getCandidateEvidenceSnapshot } from './candidateEvidenceService.js';
import { publishGeneratedCv } from './cvRevisionService.js';
import { dispatchTailoredResumes, requireTailoredResumeActions, tailoredResumeActionsConfigured } from './resumeTailoringWorkflow.js';
import { tailoringError } from './resumeTailoringContent.js';
import { remainingBudget } from '../../resume-tailoring/resumeBudget.js';
import { preparationDurations, preparationTiming } from './resumePreparationTiming.js';

export const activeResumeStatuses = ['queued', 'running'];
export const isRetiredTemplateVersion = version => typeof version === 'string' && version.startsWith('source-template:');
export const activeResumeOwner = user => ({ _id: user, deactivated: { $ne: true }, accountDeletingAt: null });
const ownerFilter = user => ({ _id: user, user });
export const evidenceMatches = (version, hash, evidence) => version == null ? evidence.version === 0 : version === evidence.version && hash === evidence.hash;
export function preparationMetadata(record, evidence) {
  const p = record?.preparation || {};
  const valid = Boolean(p.generationId && p.outputResumeSha === record.sha256);
  return { ...preparationTiming(p), status: p.status || 'unprepared', phase: p.phase || '', error: p.error || '', revision: p.revision || 0,
    sourceHash: p.sourceSha || record?.sha256 || '', attempts: p.attempts || 0,
    stale: Boolean(valid && (isRetiredTemplateVersion(p.modelVersion)
      || (evidence && !evidenceMatches(p.outputEvidenceVersion, p.outputEvidenceHash, evidence)))),
    retryable: ['unprepared', 'failed'].includes(p.status || 'unprepared'),
    hasPdf: valid, hasLatex: valid, pageCount: valid ? p.pageCount || null : null, generatedAt: p.generatedAt || null };
}
export function resumeMetadata(record, evidence) {
  return record ? { filename: record.filename, extension: record.extension, mimeType: record.mimeType,
    size: record.size, sha256: record.sha256, uploadedAt: record.uploadedAt, currentRevisionId: record.currentRevisionId || null,
    preparation: preparationMetadata(record, evidence) } : null;
}
export function requirePreparedResume(record) {
  const p = record?.preparation;
  if (!p?.generationId || p.outputResumeSha !== record.sha256 || activeResumeStatuses.includes(p.status) || isRetiredTemplateVersion(p.modelVersion)) {
    throw tailoringError('Prepare your resume before creating a job-specific version. Resume preparation is a separate step.', 409);
  }
  return p;
}

export async function requestResumePreparation(user, { regenerate = false, automatic = false, expectedSourceSha, dispatch = dispatchTailoredResumes } = {}) {
  const filter = ownerFilter(user._id);
  const current = await Resume.findOne(filter).lean();
  if (!current) throw tailoringError('Upload your resume before preparing it.', 409);
  if (!await User.exists(activeResumeOwner(user._id))) throw tailoringError('This account is unavailable.', 409);
  if (expectedSourceSha && current.sha256 !== expectedSourceSha) return resumeMetadata(current);
  const p = current.preparation || {};
  const evidence = await getCandidateEvidenceSnapshot(user._id);
  if (activeResumeStatuses.includes(p.status) || (!regenerate && p.status === 'completed' && !isRetiredTemplateVersion(p.modelVersion) && preparationMetadata(current).hasPdf
    && evidenceMatches(p.outputEvidenceVersion, p.outputEvidenceHash, evidence))) return resumeMetadata(current, evidence);
  if (!automatic && dispatch === dispatchTailoredResumes) requireTailoredResumeActions();
  const revisionFilter = p.revision === undefined ? { $or: [{ 'preparation.revision': { $exists: false } }, { 'preparation.revision': 0 }] } : { 'preparation.revision': p.revision };
  const row = await Resume.findOneAndUpdate({ ...filter, sha256: current.sha256, ...revisionFilter,
    'preparation.status': { $nin: activeResumeStatuses } }, {
    $set: { 'preparation.status': 'queued', 'preparation.phase': 'queued', 'preparation.error': '', 'preparation.ready': true,
      'preparation.sourceSha': current.sha256, 'preparation.sourceEvidenceVersion': evidence.version, 'preparation.sourceEvidenceHash': evidence.hash,
      // Reserve dispatch with readiness so recovery cannot race the first GitHub call.
      'preparation.attempts': 0, 'preparation.requestedAt': new Date(), 'preparation.dispatchAt': new Date(), 'preparation.durationSamples': preparationDurations(p) },
    $inc: { 'preparation.revision': 1 }, $unset: { 'preparation.leaseOwner': 1, 'preparation.leaseUntil': 1 },
  }, { new: true, runValidators: true }).lean();
  if (!row) return resumeMetadata(await Resume.findOne(filter).lean(), evidence);
  const revision = { ...filter, sha256: current.sha256, 'preparation.revision': row.preparation.revision, 'preparation.status': 'queued' };
  // New base requests invalidate queued tailoring immediately; their old PDF is retained.
  await TailoredResume.updateMany({ user: user._id, sourceResumeSha: current.sha256,
    sourceBaseGenerationId: p.generationId ?? null, status: { $in: activeResumeStatuses } }, {
    $set: { status: 'failed', phase: 'failed', ready: false, error: 'Your base resume is being prepared. Generate a new tailored version afterward.' },
    $inc: { revision: 1 }, $unset: { leaseOwner: 1, leaseUntil: 1 },
  });
  try {
    if (!await User.exists(activeResumeOwner(user._id))) throw tailoringError('This account is unavailable.', 409);
    await dispatch();
    await Resume.updateOne(revision, { $set: { 'preparation.dispatchAt': new Date() } });
  } catch (error) {
    await Resume.updateOne(revision, { $set: { 'preparation.status': 'failed', 'preparation.phase': 'failed', 'preparation.ready': false,
      'preparation.error': error.statusCode ? error.message : 'Resume preparation could not start. Please retry.' } });
    if (!automatic) throw error.statusCode ? error : tailoringError('Resume preparation could not start. Please retry.', 503);
  }
  return resumeMetadata(await Resume.findOne(filter).lean(), evidence);
}

async function preparationSource(row, { withData = false } = {}) {
  if (!await User.exists(activeResumeOwner(row.user))) throw tailoringError('This account is unavailable.', 409);
  const source = await Resume.findOne({ ...ownerFilter(row.user), sha256: row.preparation.sourceSha,
    'preparation.revision': row.preparation.revision, 'preparation.leaseOwner': row.preparation.leaseOwner,
    'preparation.status': 'running', 'preparation.leaseUntil': { $gt: new Date() } }).select(withData ? '+data' : '-data').lean();
  if (!source) throw tailoringError('Your resume changed. Prepare the current version.', 409);
  return source;
}

export async function drainResumePreparations({ generate, deadline = Date.now() + 30 * 60000 } = {}) {
  const counts = { attempted: 0, completed: 0, failed: 0 };
  if (deadline - Date.now() <= 15000) return counts;
  const now = new Date(); const leaseOwner = randomUUID();
  const row = await Resume.findOneAndUpdate({ 'preparation.ready': true, 'preparation.attempts': { $lt: 3 }, $or: [
    { 'preparation.status': 'queued' }, { 'preparation.status': 'running', 'preparation.leaseUntil': { $lt: now } },
  ] }, { $set: { 'preparation.status': 'running', 'preparation.phase': 'extracting', 'preparation.leaseOwner': leaseOwner,
    'preparation.leaseUntil': new Date(Math.max(deadline, now.getTime() + 30 * 60000)) }, $inc: { 'preparation.attempts': 1 } }, { new: true, sort: { 'preparation.requestedAt': 1 } }).select('+preparation.leaseOwner').lean();
  if (!row) return counts;
  counts.attempted = 1;
  const lease = { ...ownerFilter(row.user), sha256: row.preparation.sourceSha, 'preparation.revision': row.preparation.revision,
    'preparation.status': 'running', 'preparation.leaseOwner': leaseOwner, 'preparation.leaseUntil': { $gt: new Date() } };
  try {
    const source = await preparationSource(row, { withData: true });
    const evidence = await getCandidateEvidenceSnapshot(row.user);
    if (!evidenceMatches(row.preparation.sourceEvidenceVersion, row.preparation.sourceEvidenceHash, evidence)) throw tailoringError('Your candidate evidence changed. Prepare a new version.', 409);
    const { extractResumeSource } = await import('./resumeSource.js');
    const document = await extractResumeSource({ extension: source.extension, data: artifactBytes(source.data), deadline });
    const output = await generate({ mode: 'base', source: document, candidateEvidence: evidence }, { deadline, onPhase: async (phase, { signal } = {}) => {
      await Resume.updateOne({ ...lease, 'preparation.leaseUntil': { $gt: new Date() } }, { $set: { 'preparation.phase': String(phase).slice(0, 100) } },
        { signal, timeoutMS: remainingBudget(deadline, 5000) });
    } });
    if (Date.now() >= deadline) throw tailoringError('Resume preparation exceeded its time budget. Please retry.', 504);
    await publishGeneratedCv({ kind: 'base', row, lease, output, source, document, evidence });
    counts.completed = 1;
  } catch (error) {
    counts.failed = 1;
    const failure = { 'preparation.status': 'failed', 'preparation.phase': 'failed', 'preparation.ready': false,
      'preparation.error': error.statusCode ? error.message : 'Resume preparation was interrupted or returned an invalid document. Please retry.' };
    await Resume.updateOne({ ...lease, 'preparation.leaseUntil': { $gt: new Date() } }, { $set: failure,
      $unset: { 'preparation.leaseOwner': 1, 'preparation.leaseUntil': 1 } });
  }
  return counts;
}

export async function getBaseResumeArtifact(user) {
  const row = await Resume.findOne(ownerFilter(user._id)).lean();
  if (!row || !preparationMetadata(row).hasPdf) throw tailoringError('Prepare your resume before downloading the generated version.', 404);
  const evidence = await getCandidateEvidenceSnapshot(user._id);
  if (!evidenceMatches(row.preparation.outputEvidenceVersion, row.preparation.outputEvidenceHash, evidence)) throw tailoringError('Your candidate evidence changed. Prepare a current CV or download the earlier version from history.', 409);
  const artifact = await readResumeArtifact(user._id, row.preparation.generationId, { kind: 'base' });
  if (!artifact || artifact.sourceResumeSha !== row.sha256) throw tailoringError('Prepare your current resume again.', 409);
  return { artifact, filename: row.filename };
}

export async function recoverResumePreparations({ now = new Date(), dispatch = dispatchTailoredResumes, dispatchPending = true } = {}) {
  await Resume.updateMany({ 'preparation.status': { $in: activeResumeStatuses }, $or: [
    { 'preparation.requestedAt': { $lt: new Date(now.getTime() - 86400000) } },
    { 'preparation.status': 'running', 'preparation.attempts': { $gte: 3 }, 'preparation.leaseUntil': { $lt: now } },
  ] }, { $set: { 'preparation.status': 'failed', 'preparation.phase': 'failed', 'preparation.ready': false,
    'preparation.error': 'This preparation request was interrupted. Please retry.' }, $unset: { 'preparation.leaseOwner': 1, 'preparation.leaseUntil': 1 } });
  await Resume.updateMany({ 'preparation.status': 'running', 'preparation.attempts': { $lt: 3 }, 'preparation.leaseUntil': { $lt: now } }, {
    $set: { 'preparation.status': 'queued', 'preparation.phase': 'queued' }, $unset: { 'preparation.leaseOwner': 1, 'preparation.leaseUntil': 1 },
  });
  const due = { 'preparation.status': 'queued', 'preparation.ready': true, $or: [
    { 'preparation.dispatchAt': { $exists: false } }, { 'preparation.dispatchAt': { $lt: new Date(now.getTime() - 300000) } },
  ] };
  const pending = Boolean(await Resume.exists(due));
  if (pending && dispatchPending && (dispatch !== dispatchTailoredResumes || tailoredResumeActionsConfigured())) {
    try { await dispatch({ reuseRunning: true }); await Resume.updateMany(due, { $set: { 'preparation.dispatchAt': now } }); } catch { /* Keep durable queued work for recovery. */ }
  }
  return { pending, due };
}
