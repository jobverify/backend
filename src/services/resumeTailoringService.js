import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Resume from '../models/Resume.js';
import TailoredResume from '../models/TailoredResume.js';
import SiteSettings from '../models/SiteSettings.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';
import { dispatchTailoredResumes, tailoredResumeActionsConfigured, requireTailoredResumeActions, RESUME_WORKFLOW_STOPPED } from './resumeTailoringWorkflow.js';
import { dayKey, reserveUsage } from './resumeUsage.js';
import { tailoringError } from './resumeTailoringContent.js';
import { artifactBytes, readResumeArtifact } from './resumeArtifactService.js';
import { activeResumeOwner, activeResumeStatuses, requirePreparedResume, drainResumePreparations, recoverResumePreparations, evidenceMatches, isRetiredTemplateVersion } from './resumePreparationService.js';
import { getCandidateEvidenceSnapshot } from './candidateEvidenceService.js';
import { publishGeneratedCv } from './cvRevisionService.js';
import { remainingBudget } from '../../resume-tailoring/resumeBudget.js';

const recordId = (user, job) => `${user}:${job}`;

async function context(user, jobId, { settings = {}, requireResume = false, withData = false } = {}) {
  if (!/^[a-f0-9]{24}$/i.test(String(jobId || ''))) throw tailoringError('Invalid job ID.');
  const owner = await User.findOne(activeResumeOwner(user._id)).select('savedJobs').lean();
  if (!owner) throw tailoringError('This account is unavailable.', 409);
  if (!owner.savedJobs?.some(id => String(id) === String(jobId))) throw tailoringError('Saved job not found. Bookmark this job first.', 404);
  const [job, resume] = await Promise.all([
    Job.findOne(applyPublicJobVisibility({ _id: jobId, status: 'active' }, settings || {})).lean(),
    Resume.findOne({ _id: owner._id, user: owner._id }).select(withData ? '+data' : '-data').lean(),
  ]);
  if (!job) throw tailoringError('This saved job is no longer available.', 404);
  if (requireResume && !resume) throw tailoringError('Upload your resume before creating a tailored resume.', 409);
  if (requireResume) requirePreparedResume(resume);
  const evidence = await getCandidateEvidenceSnapshot(user._id);
  if (requireResume && !evidenceMatches(resume.preparation.outputEvidenceVersion, resume.preparation.outputEvidenceHash, evidence)) throw tailoringError('Your candidate evidence changed. Prepare your base resume again before tailoring.', 409);
  const { resumeJobHash, buildResumeJobSnapshot } = await import('./resumeLatexContent.js');
  return { job, resume, evidence, hash: resumeJobHash(job), jobSnapshot: buildResumeJobSnapshot(job) };
}

function publicRecord(row, source) {
  if (!row) return null;
  const hasArtifact = Boolean(row.generationId);
  const legacy = Boolean(!hasArtifact && row.output);
  return { id: row._id, jobId: String(row.job), status: row.status, phase: row.phase || '', error: row.error || '',
    stale: Boolean((hasArtifact || legacy) && (isRetiredTemplateVersion(row.modelVersion)
      || row.outputResumeSha !== source.resume?.sha256 || row.outputJobHash !== source.hash
      || (hasArtifact && row.outputBaseGenerationId !== source.resume?.preparation?.generationId)
      || (source.evidence && !evidenceMatches(row.outputEvidenceVersion, row.outputEvidenceHash, source.evidence)))),
    hasPdf: hasArtifact, hasLatex: hasArtifact, pageCount: hasArtifact ? row.pageCount || null : null,
    outputFormat: hasArtifact ? 'latex-pdf' : legacy ? 'legacy-json' : 'latex-pdf', legacy,
    generatedAt: row.generatedAt || null, currentRevisionId: row.currentRevisionId || null, sourceFilename: source.resume?.filename || '', updatedAt: row.updatedAt };
}

export async function getTailoredResume(user, jobId, settings) {
  const source = await context(user, jobId, { settings });
  return publicRecord(await TailoredResume.findOne({ _id: recordId(user._id, jobId), user: user._id }).lean(), source);
}

export async function getTailoredResumeArtifact(user, jobId, settings) {
  const source = await context(user, jobId, { settings });
  const row = await TailoredResume.findOne({ _id: recordId(user._id, jobId), user: user._id }).lean();
  const view = publicRecord(row, source);
  if (view?.legacy) throw tailoringError('This older resume needs regeneration before PDF or TeX download.', 409);
  if (!view?.hasPdf) throw tailoringError('Generate a tailored resume first.', 404);
  if (view.stale) throw tailoringError('Your resume or this job changed. Generate a new version before downloading.', 409);
  const artifact = await readResumeArtifact(user._id, row.generationId, { kind: 'tailored', job: jobId });
  if (!artifact || artifact.sourceResumeSha !== source.resume?.sha256 || artifact.sourceJobHash !== source.hash
    || artifact.sourceBaseGenerationId !== source.resume?.preparation?.generationId) throw tailoringError('Generate a current tailored resume before downloading.', 409);
  return { artifact, job: source.job };
}

const matchesSource = (source, row) => source.resume?.sha256 === row.sourceResumeSha && source.hash === row.sourceJobHash
  && source.resume?.preparation?.generationId === row.sourceBaseGenerationId
  && evidenceMatches(row.sourceEvidenceVersion, row.sourceEvidenceHash, source.evidence);

export async function requestTailoredResume(user, jobId, { regenerate = false, settings, dispatch = dispatchTailoredResumes } = {}) {
  const source = await context(user, jobId, { settings, requireResume: true });
  const id = recordId(user._id, jobId);
  const current = await TailoredResume.findOne({ _id: id, user: user._id }).lean();
  const view = publicRecord(current, source);
  if (current && activeResumeStatuses.includes(current.status)) return view;
  if (current?.generationId && !view.stale && !regenerate) return view;
  if (dispatch === dispatchTailoredResumes) requireTailoredResumeActions();
  let row;
  try {
    row = await TailoredResume.findOneAndUpdate({ _id: id, user: user._id, status: { $nin: activeResumeStatuses } }, {
      $set: { status: 'queued', phase: 'queued', ready: false, sourceResumeSha: source.resume.sha256, sourceJobHash: source.hash,
        sourceBaseGenerationId: source.resume.preparation.generationId, sourceEvidenceVersion: source.evidence.version,
        sourceEvidenceHash: source.evidence.hash, error: '', attempts: 0, requestedAt: new Date() },
      $setOnInsert: { user: user._id, job: jobId }, $inc: { revision: 1 }, $unset: { leaseOwner: 1, leaseUntil: 1, dispatchAt: 1 },
    }, { upsert: true, new: true, runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return publicRecord(await TailoredResume.findOne({ _id: id, user: user._id }).lean(), source);
  }
  const revision = { _id: id, user: user._id, revision: row.revision, status: 'queued' };
  try {
    await reserveUsage(`user:${user._id}:tailored-resumes:${dayKey()}`, 10, { user: user._id });
    const fresh = await context(user, jobId, { settings, requireResume: true });
    if (!matchesSource(fresh, row)) throw tailoringError('Your resume or this job changed. Please retry.', 409);
    // Reserve dispatch before recovery can see ready queued work.
    const ready = await TailoredResume.updateOne(revision, { $set: { ready: true, dispatchAt: new Date() } });
    if (!ready.matchedCount) throw tailoringError('This request changed. Please retry.', 409);
    await dispatch();
    await TailoredResume.updateOne(revision, { $set: { dispatchAt: new Date() } });
  } catch (error) {
    const message = error.statusCode ? error.message : 'Resume generation could not start. Please retry.';
    await TailoredResume.updateOne(revision, { $set: { status: 'failed', phase: 'failed', ready: false, error: message } });
    if (!await User.exists(activeResumeOwner(user._id))) await TailoredResume.deleteOne({ _id: id, user: user._id });
    throw error.statusCode ? error : tailoringError(message, 503);
  }
  return publicRecord(await TailoredResume.findOne({ _id: id, user: user._id }).lean(), source);
}

export async function drainTailoredResumes({ generate, deadline = Date.now() + 30 * 60000 } = {}) {
  const counts = { attempted: 0, completed: 0, failed: 0 };
  if (deadline - Date.now() <= 15000) return counts;
  const now = new Date(); const leaseOwner = randomUUID();
  const row = await TailoredResume.findOneAndUpdate({ ready: true, attempts: { $lt: 3 }, $or: [
    { status: 'queued' }, { status: 'running', leaseUntil: { $lt: now } },
  ] }, { $set: { status: 'running', phase: 'extracting', leaseOwner, leaseUntil: new Date(Math.max(deadline, now.getTime() + 30 * 60000)) }, $inc: { attempts: 1 } },
  { new: true, sort: { requestedAt: 1 } }).select('+leaseOwner').lean();
  if (!row) return counts;
  counts.attempted = 1;
  const lease = { _id: row._id, user: row.user, revision: row.revision, status: 'running', leaseOwner,
    sourceResumeSha: row.sourceResumeSha, sourceJobHash: row.sourceJobHash, sourceBaseGenerationId: row.sourceBaseGenerationId };
  try {
    const settings = await SiteSettings.findOne().lean();
    const source = await context({ _id: row.user }, row.job, { settings, requireResume: true, withData: true });
    if (!matchesSource(source, row)) throw tailoringError('Your resume or this job changed. Generate a new version.', 409);
    const base = await readResumeArtifact(row.user, row.sourceBaseGenerationId, { kind: 'base', withSource: true });
    if (!base || base.sourceResumeSha !== row.sourceResumeSha) throw tailoringError('Prepare your current resume before tailoring it.', 409);
    const { extractResumeSource } = await import('./resumeSource.js');
    const document = await extractResumeSource({ extension: source.resume.extension, data: artifactBytes(source.resume.data), deadline });
    const output = await generate({ mode: 'tailored', source: document, baseLatex: artifactBytes(base.latex).toString('utf8'), facts: base.facts,
      jobSnapshot: source.jobSnapshot, candidateEvidence: source.evidence }, { deadline, onPhase: async (phase, { signal } = {}) => {
      await TailoredResume.updateOne({ ...lease, leaseUntil: { $gt: new Date() } }, { $set: { phase: String(phase).slice(0, 100) } },
        { signal, timeoutMS: remainingBudget(deadline, 5000) });
    } });
    if (Date.now() >= deadline) throw tailoringError('Resume generation exceeded its time budget. Please retry.', 504);
    const fresh = await context({ _id: row.user }, row.job, { settings, requireResume: true });
    if (!matchesSource(fresh, row)) throw tailoringError('Your resume or this job changed. Generate a new version.', 409);
    await publishGeneratedCv({ kind: 'tailored', row, lease, output, source: source.resume, document, evidence: source.evidence, jobSnapshot: source.jobSnapshot });
    counts.completed = 1;
  } catch (error) {
    counts.failed = 1;
    const errorMessage = error.statusCode ? error.message : 'Resume generation was interrupted or returned an invalid document. Please retry.';
    await TailoredResume.updateOne({ ...lease, leaseUntil: { $gt: new Date() } }, { $set: { status: 'failed', phase: 'failed', ready: false, error: errorMessage }, $unset: { leaseOwner: 1, leaseUntil: 1 } });
    if (!await User.exists(activeResumeOwner(row.user))) await TailoredResume.deleteOne({ _id: row._id, user: row.user });
  }
  return counts;
}

export async function nextResumeDocumentTask(now = new Date()) {
  const [base, tailored] = await Promise.all([
    Resume.findOne({ 'preparation.ready': true, 'preparation.attempts': { $lt: 3 }, $or: [
      { 'preparation.status': 'queued' }, { 'preparation.status': 'running', 'preparation.leaseUntil': { $lt: now } },
    ] }).sort({ 'preparation.requestedAt': 1 }).select('_id user preparation.revision preparation.status preparation.requestedAt').lean(),
    TailoredResume.findOne({ ready: true, attempts: { $lt: 3 }, $or: [
      { status: 'queued' }, { status: 'running', leaseUntil: { $lt: now } },
    ] }).sort({ requestedAt: 1 }).select('_id user revision status requestedAt').lean(),
  ]);
  if (!base && !tailored) return null;
  if (base && (!tailored || new Date(base.preparation.requestedAt || 0) <= new Date(tailored.requestedAt || 0))) return { kind: 'base', row: base };
  return { kind: 'tailored', row: tailored };
}

export async function drainResumeDocuments(options = {}) {
  const task = options.task || await nextResumeDocumentTask();
  if (!task) return { attempted: 0, completed: 0, failed: 0 };
  return task.kind === 'base' ? drainResumePreparations(options) : drainTailoredResumes(options);
}

let recovering = false;
export async function recoverTailoredResumes({ dispatch = dispatchTailoredResumes, now = new Date() } = {}) {
  if (recovering) return;
  recovering = true;
  try {
    const preparation = await recoverResumePreparations({ dispatch, now, dispatchPending: false });
    await TailoredResume.updateMany({ status: { $in: activeResumeStatuses }, $or: [
      { requestedAt: { $lt: new Date(now.getTime() - 86400000) } },
      { requestedAt: { $exists: false }, createdAt: { $lt: new Date(now.getTime() - 86400000) } },
      { status: 'running', attempts: { $gte: 3 }, leaseUntil: { $lt: now } },
      { status: 'queued', ready: false, updatedAt: { $lt: new Date(now.getTime() - 60000) } },
    ] }, { $set: { status: 'failed', phase: 'failed', ready: false, error: 'This request was interrupted. Please retry generation.' }, $unset: { leaseOwner: 1, leaseUntil: 1 } });
    await TailoredResume.updateMany({ status: 'running', attempts: { $lt: 3 }, leaseUntil: { $lt: now } }, { $set: { status: 'queued', phase: 'queued' }, $unset: { leaseOwner: 1, leaseUntil: 1 } });
    if (dispatch === dispatchTailoredResumes && !tailoredResumeActionsConfigured()) return;
    const due = { status: 'queued', ready: true, $or: [{ dispatchAt: { $exists: false } }, { dispatchAt: { $lt: new Date(now.getTime() - 300000) } }] };
    if (preparation.pending || await TailoredResume.exists(due)) {
      try { await dispatch({ reuseRunning: true, recovery: true }); await Promise.all([TailoredResume.updateMany(due, { $set: { dispatchAt: now } }), Resume.updateMany(preparation.due, { $set: { 'preparation.dispatchAt': now } })]); }
      catch (error) {
        if (error.code === RESUME_WORKFLOW_STOPPED) await Promise.all([
          TailoredResume.updateMany(due, { $set: { status: 'failed', phase: 'failed', ready: false, error: error.message } }),
          Resume.updateMany(preparation.due, { $set: { 'preparation.status': 'failed', 'preparation.phase': 'failed',
            'preparation.ready': false, 'preparation.error': error.message } }),
        ]);
        // Transient API outages retain durable queued work for later recovery.
      }
    }
  } finally { recovering = false; }
}
