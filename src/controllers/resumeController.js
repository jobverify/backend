import Resume from '../models/Resume.js';
import TailoredResume from '../models/TailoredResume.js';
import User from '../models/User.js';
import { inspectResume, ResumeValidationError } from '../utils/resumeFile.js';
import { respondWithInternalError } from '../utils/respondWithInternalError.js';
import { resumeMetadata, requestResumePreparation, getBaseResumeArtifact } from '../services/resumePreparationService.js';
import { artifactBytes } from '../services/resumeArtifactService.js';
import { getCandidateEvidenceSnapshot } from '../services/candidateEvidenceService.js';
import { retainLegacyCv, removeCvDocuments } from '../services/cvRevisionService.js';
import { preparationDurations } from '../services/resumePreparationTiming.js';

const metadata = resumeMetadata;
const ownerFilter = user => ({ _id: user._id, user: user._id });
const activeOwner = user => ({ _id: user._id, deactivated: { $ne: true }, accountDeletingAt: null });
// Mongoose validation errors can contain the uploaded bytes. Log only error
// classification, never a resume document, query payload, or filename.
const failure = (res, error, message) => respondWithInternalError(res,
  { name: error?.name, code: Number.isInteger(error?.code) ? error.code : undefined },
  { message, logLabel: '[Resume] Storage request failed:' });

export async function getResume(req, res) {
  try {
    const record = await Resume.findOne(ownerFilter(req.user)).lean();
    return res.status(200).json({ success: true, data: metadata(record, record ? await getCandidateEvidenceSnapshot(req.user._id) : undefined) });
  } catch (error) {
    return failure(res, error, 'Could not load your resume.');
  }
}

export async function uploadResume(req, res) {
  try {
    let filename;
    try { filename = decodeURIComponent(req.headers['x-resume-filename'] ?? ''); }
    catch { throw new ResumeValidationError('The resume filename is invalid.'); }
    const file = inspectResume(filename, req.body);
    if (!await User.exists(activeOwner(req.user))) return res.status(409).json({ success: false, message: 'This account is unavailable for resume uploads.' });
    const filter = ownerFilter(req.user);
    let record;
    let previous;
    for (let attempt = 0; attempt < 5 && !record; attempt++) {
      const current = await Resume.findOne(filter).lean();
      if (current?.sha256 === file.sha256) {
        return res.status(200).json({ success: true, data: metadata(current,
          current.preparation?.generationId ? await getCandidateEvidenceSnapshot(req.user._id) : undefined) });
      }
      if (current?.preparation?.generationId && !current.currentRevisionId) {
        await retainLegacyCv(req.user, { kind: 'base' });
        continue;
      }
      const update = { $set: { ...file, data: req.body, uploadedAt: new Date(),
        'preparation.status': 'unprepared', 'preparation.phase': '', 'preparation.error': '', 'preparation.ready': false,
        'preparation.sourceSha': file.sha256, 'preparation.attempts': 0,
        'preparation.durationSamples': preparationDurations(current?.preparation) },
      $setOnInsert: { user: req.user._id }, $inc: { 'preparation.revision': 1 },
      $unset: { 'preparation.generationId': 1, 'preparation.outputResumeSha': 1, 'preparation.pageCount': 1,
        currentRevisionId: 1, 'preparation.sourceEvidenceVersion': 1, 'preparation.sourceEvidenceHash': 1,
        'preparation.outputEvidenceVersion': 1, 'preparation.outputEvidenceHash': 1,
        'preparation.generatedAt': 1, 'preparation.leaseOwner': 1, 'preparation.leaseUntil': 1,
        'preparation.dispatchAt': 1, 'preparation.requestedAt': 1, 'preparation.modelVersion': 1, 'preparation.styleVersion': 1 } };
      try {
        // Pin the metadata used by cleanup as well as the source bytes. A base
        // can finish preparing between our read and this replacement CAS.
        const version = current ? { sha256: current.sha256,
          'preparation.revision': current.preparation?.revision ?? { $exists: false },
          'preparation.generationId': current.preparation?.generationId ?? { $exists: false } } : {};
        record = await Resume.findOneAndUpdate({ ...filter, ...version }, update,
          { upsert: !current, new: true, runValidators: true, setDefaultsOnInsert: false });
        if (record) previous = current;
      } catch (error) { if (error.code !== 11000) throw error; }
    }
    if (!record) return res.status(409).json({ success: false, message: 'Your resume changed during upload. Please retry.' });
    // An account may be removed while its upload is in flight. Do not recreate
    // personal data after its deletion sweep has already passed this collection.
    if (!await User.exists(activeOwner(req.user))) {
      await Resume.deleteOne({ ...filter, sha256: file.sha256 });
      return res.status(409).json({ success: false, message: 'This account is unavailable for resume uploads.' });
    }
    if (previous) {
      await TailoredResume.updateMany({ user: req.user._id, status: { $in: ['queued', 'running'] }, sourceResumeSha: previous.sha256,
        sourceBaseGenerationId: previous.preparation?.generationId ?? null }, {
        $set: { status: 'failed', phase: 'failed', ready: false, error: 'Your resume changed. Generate a new version.' },
        $inc: { revision: 1 }, $unset: { leaseOwner: 1, leaseUntil: 1 },
      });
    }
    const data = await requestResumePreparation(req.user, { automatic: true, expectedSourceSha: file.sha256 });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof ResumeValidationError) return res.status(error.statusCode).json({ success: false, message: error.message });
    return failure(res, error, 'Could not save your resume. Please try again.');
  }
}

export async function downloadResume(req, res) {
  try {
    const record = await Resume.findOne(ownerFilter(req.user)).select('+data');
    if (!record) return res.status(404).json({ success: false, message: 'You have not uploaded a resume yet.' });
    res.attachment(record.filename);
    res.set('Content-Type', record.mimeType);
    res.set('Content-Length', String(record.data.length));
    return res.send(record.data);
  } catch (error) {
    return failure(res, error, 'Could not download your resume.');
  }
}

export async function removeResume(req, res) {
  try {
    await removeCvDocuments(req.user);
    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return failure(res, error, 'Could not remove your resume. Please try again.');
  }
}

export async function prepareResume(req, res) {
  try {
    if (req.body?.regenerate !== undefined && typeof req.body.regenerate !== 'boolean') return res.status(400).json({ success: false, message: 'Regenerate must be true or false.' });
    const data = await requestResumePreparation(req.user, { regenerate: req.body?.regenerate === true });
    return res.status(['queued', 'running'].includes(data?.preparation.status) ? 202 : 200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return failure(res, error, 'Could not prepare your resume. Please try again.');
  }
}

export async function baseResume(req, res) {
  try {
    const format = req.query.format || 'pdf';
    if (!['pdf', 'tex'].includes(format)) return res.status(400).json({ success: false, message: 'Choose PDF or TeX format.' });
    const { artifact, filename } = await getBaseResumeArtifact(req.user);
    const stem = String(filename || 'resume').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 150) || 'resume';
    const data = artifactBytes(format === 'pdf' ? artifact.pdf : artifact.latex);
    if (req.path.endsWith('/download')) res.attachment(`${stem}-prepared.${format}`);
    else res.set('Content-Disposition', `inline; filename="resume-prepared.${format}"`);
    res.set('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/x-tex; charset=utf-8');
    res.set('Content-Length', String(data.length));
    return res.send(data);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return failure(res, error, 'Could not load your prepared resume.');
  }
}
