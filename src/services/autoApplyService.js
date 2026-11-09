import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import AutoApplyAttempt from '../models/AutoApplyAttempt.js';
import Application from '../models/Application.js';
import ApplicationEvent from '../models/ApplicationEvent.js';
import User from '../models/User.js';
import SiteSettings from '../models/SiteSettings.js';
import { APIError } from '../middleware/errorHandler.js';
import { getTailoredResumeArtifact } from './resumeTailoringService.js';
import { artifactBytes } from './resumeArtifactService.js';
import { recordApplicationOpen, recordApplicationEvidence, safeApplicationUrl } from './applicationService.js';
import { hashValue, supportedTarget } from './autoApplyPolicy.js';
import { validEmail } from '../utils/validEmail.js';

export const autoApplyEnabled = () => process.env.AUTO_APPLY_ENABLED === 'true';
const ownerFilter = (user, version) => ({ _id: user, deactivated: { $ne: true }, accountDeletingAt: null, ...(version === undefined ? {} : { sessionVersion: version }) });
async function requireOwner(user, version) {
  if (!await User.exists(ownerFilter(user, version))) throw new APIError(401, 'Your account or session is no longer active.');
}

export async function cleanupInactiveAutoApplyData(user) {
  if (await User.exists({ _id: user, accountDeletingAt: null })) return false;
  await Promise.all([AutoApplyAttempt.deleteMany({ user }), Application.deleteMany({ user }), ApplicationEvent.deleteMany({ user })]);
  return true;
}
const publicAttempt = row => row ? ({ id: row._id, jobId: String(row.job), status: row.status, provider: row.provider, url: row.url, title: row.title, company: row.company,
  generationId: row.generationId, reviewToken: row.reviewToken, fields: row.manifest?.fields || [], answers: row.answers || {},
  approvedAt: row.approvedAt, submitStartedAt: row.submitStartedAt, error: row.error || '', confirmation: row.confirmation || '' }) : null;

export async function loadAutoApplySource(user, jobId, settings) {
  const { artifact, job } = await getTailoredResumeArtifact(user, jobId, settings);
  const owner = await User.findOne(ownerFilter(user._id)).select('email profile.name').lean();
  if (!owner) throw new APIError(401, 'Your account is no longer active.');
  return { job, pdf: artifactBytes(artifact.pdf), generationId: artifact._id, jobHash: artifact.sourceJobHash,
    profile: { name: owner.profile?.name || '', email: owner.email || '' } };
}

function requireUnchanged(row, source) {
  const target = supportedTarget(safeApplicationUrl(source.job));
  if (!target || target.url !== row.url || source.generationId !== row.generationId || hashValue(source.pdf) !== row.pdfSha || source.jobHash !== row.jobHash) {
    throw new APIError(409, 'The job or resume changed. Prepare and review a new application.');
  }
}

export async function getAutoApplyAttempt(user, jobId, { enabled = autoApplyEnabled() } = {}) {
  if (!mongoose.isObjectIdOrHexString(jobId)) throw new APIError(400, 'Invalid job ID.');
  const row = await AutoApplyAttempt.findOne({ user, job: jobId }).lean();
  return { enabled, attempt: publicAttempt(row) };
}

export async function createAutoApplyAttempt(user, jobId, { enabled = autoApplyEnabled(), loadSource = loadAutoApplySource, settings } = {}) {
  if (!enabled) throw new APIError(503, 'Automated applications are not enabled on this server.');
  if (!mongoose.isObjectIdOrHexString(jobId)) throw new APIError(400, 'Invalid job ID.');
  await requireOwner(user._id, user.sessionVersion ?? 0);
  const id = `${user._id}:${jobId}`;
  const existing = await AutoApplyAttempt.findOne({ _id: id, user: user._id }).lean();
  if (existing?.status === 'unconfirmed') throw new APIError(409, 'Check the employer site or your email and confirm the outcome before another submission.');
  if (existing && !['blocked', 'cancelled'].includes(existing.status)) return publicAttempt(existing);
  if (await Application.exists({ user: user._id, job: jobId, status: 'applied' })) throw new APIError(409, 'This job is already recorded as applied.');
  const source = await loadSource(user, jobId, settings);
  const target = supportedTarget(safeApplicationUrl(source.job));
  if (!target) throw new APIError(422, 'Automated submission supports public Lever and Greenhouse job forms. Use Apply for this employer.');
  const application = await recordApplicationOpen(user._id, source.job);
  const data = { status: 'queued_inspection', sessionVersion: user.sessionVersion ?? 0, application: application._id,
    ...target, title: source.job.title, company: source.job.company, generationId: source.generationId, pdfSha: hashValue(source.pdf), jobHash: source.jobHash,
    reviewToken: randomUUID(), manifest: null, formHash: '', answers: {}, approvedAt: null, submitStartedAt: null, error: '', confirmation: '', leaseToken: '', leaseUntil: new Date(0) };
  try {
    const row = await AutoApplyAttempt.findOneAndUpdate({ _id: id, user: user._id, status: { $in: ['blocked', 'cancelled'] } },
      { $set: data, $setOnInsert: { user: user._id, job: jobId } }, { upsert: true, new: true, runValidators: true });
    await requireOwner(user._id, user.sessionVersion ?? 0);
    return publicAttempt(row);
  } catch (error) {
    if (await cleanupInactiveAutoApplyData(user._id)) {
      throw new APIError(401, 'Your account is no longer active.');
    }
    if (error.code === 11000) return publicAttempt(await AutoApplyAttempt.findOne({ _id: id, user: user._id }).lean());
    throw error;
  }
}

export function validateAutoApplyAnswers(manifest, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 50000) throw new APIError(400, 'Provide the reviewed application answers.');
  const fields = manifest?.fields || [];
  if (Object.keys(input).some(key => !fields.some(field => field.key === key && field.kind !== 'file'))) throw new APIError(400, 'The application contains an unknown answer.');
  const answers = {};
  for (const field of fields) {
    if (field.kind === 'file') continue;
    const value = input[field.key];
    if (field.kind === 'checkbox') {
      if ((value !== undefined && typeof value !== 'boolean') || (field.required && value !== true)) throw new APIError(400, `Review ${field.label}.`);
      answers[field.key] = value === true; continue;
    }
    if (value !== undefined && typeof value !== 'string') throw new APIError(400, `Provide text for ${field.label}.`);
    const text = (value || '').trim();
    if ((field.required && !text) || text.length > Math.min(field.maxLength > 0 ? field.maxLength : 5000, 5000)) throw new APIError(400, `Complete ${field.label}.`);
    if (text && ['select', 'radio'].includes(field.kind) && !field.options?.some(option => option.value === text)) throw new APIError(400, `Choose a listed answer for ${field.label}.`);
    if (text && field.kind === 'email' && !validEmail(text)) throw new APIError(400, `Enter a valid email for ${field.label}.`);
    if (text && field.kind === 'url') { try { if (!['https:', 'http:'].includes(new URL(text).protocol)) throw new Error(); } catch { throw new APIError(400, `Enter a valid link for ${field.label}.`); } }
    answers[field.key] = text;
  }
  return answers;
}

export async function approveAutoApplyAttempt(user, id, input, { enabled = autoApplyEnabled(), loadSource = loadAutoApplySource, settings } = {}) {
  if (!enabled) throw new APIError(503, 'Automated applications are not enabled on this server.');
  await requireOwner(user._id, user.sessionVersion ?? 0);
  const row = await AutoApplyAttempt.findOne({ _id: id, user: user._id, status: 'review', reviewToken: typeof input.reviewToken === 'string' ? input.reviewToken : '' }).lean();
  if (!row || input.confirm !== true) throw new APIError(409, 'Review this application and explicitly approve submission.');
  const source = await loadSource(user, String(row.job), settings);
  requireUnchanged(row, source);
  const answers = validateAutoApplyAnswers(row.manifest, input.answers);
  const updated = await AutoApplyAttempt.findOneAndUpdate({ _id: id, user: user._id, status: 'review', reviewToken: row.reviewToken }, {
    $set: { answers, status: 'queued_submission', approvedAt: new Date(), sessionVersion: user.sessionVersion ?? 0 },
  }, { new: true });
  if (!updated) throw new APIError(409, 'This application changed. Reload before submitting.');
  return publicAttempt(updated);
}

export async function cancelAutoApplyAttempt(user, id) {
  const row = await AutoApplyAttempt.findOneAndUpdate({ _id: id, user, status: { $in: ['queued_inspection', 'inspecting', 'review', 'queued_submission', 'submitting'] }, submitStartedAt: null },
    { $set: { status: 'cancelled', leaseToken: '', leaseUntil: new Date(0) } }, { new: true });
  if (!row) throw new APIError(409, 'Submission has started or this request is no longer pending.');
  return publicAttempt(row);
}

function prefill(fields, profile) {
  return Object.fromEntries(fields.filter(field => field.kind !== 'file').map(field => {
    let value = field.kind === 'checkbox' ? false : '';
    if (field.kind === 'email' || /^e-?mail(?: address)?$/i.test(field.label.trim())) value = profile.email || '';
    if (/^(?:full |your )?name$/i.test(field.label.trim())) value = profile.name || '';
    return [field.key, value];
  }));
}

export async function processAutoApplyQueue({ enabled = autoApplyEnabled(), loadSource = loadAutoApplySource, browser, now = new Date() } = {}) {
  if (!enabled) return { processed: 0 };
  await AutoApplyAttempt.updateMany({ status: 'submitting', leaseUntil: { $lte: now }, submitStartedAt: { $ne: null } }, {
    $set: { status: 'unconfirmed', error: 'Submission may have reached the employer. Check the employer site or email; this request will not be retried.', leaseToken: '' },
  });
  await AutoApplyAttempt.updateMany({ status: 'submitting', leaseUntil: { $lte: now }, submitStartedAt: null }, {
    $set: { status: 'blocked', error: 'The worker stopped before submitting. Prepare and review the application again.', leaseToken: '' },
  });
  const leaseToken = randomUUID();
  const row = await AutoApplyAttempt.findOneAndUpdate({ $or: [{ status: { $in: ['queued_inspection', 'queued_submission'] } }, { status: 'inspecting', leaseUntil: { $lte: now } }] },
    [{ $set: { status: { $cond: [{ $eq: ['$status', 'queued_submission'] }, 'submitting', 'inspecting'] }, leaseToken, leaseUntil: new Date(now.getTime() + 5 * 60000), updatedAt: now } }],
    { new: true, updatePipeline: true, sort: { createdAt: 1 } }).select('+leaseToken').lean();
  if (!row) return { processed: 0 };
  const lease = { _id: row._id, user: row.user, status: row.status, reviewToken: row.reviewToken, leaseToken };
  let submitStarted = false;
  try {
    await requireOwner(row.user, row.sessionVersion);
    const settings = await SiteSettings.findOne().lean();
    const source = await loadSource({ _id: row.user }, String(row.job), settings);
    requireUnchanged(row, source);
    const adapter = browser || await import('./autoApplyBrowser.js');
    if (row.status === 'inspecting') {
      const result = await adapter.inspect({ url: row.url, provider: row.provider });
      if (!result.manifest || result.reason) throw new APIError(422, result.reason || 'This form cannot be completed automatically. Use the employer website.');
      await AutoApplyAttempt.updateOne(lease, { $set: { status: 'review', manifest: result.manifest, formHash: hashValue(result.manifest),
        answers: prefill(result.manifest.fields, source.profile), error: '', leaseToken: '', leaseUntil: new Date(0) } });
    } else {
      if (!row.approvedAt) throw new APIError(409, 'Submission needs approval.');
      validateAutoApplyAnswers(row.manifest, row.answers);
      const result = await adapter.submit({ url: row.url, provider: row.provider, manifest: row.manifest, formHash: row.formHash, answers: row.answers, pdf: source.pdf,
        beforeSubmit: async () => {
          await requireOwner(row.user, row.sessionVersion);
          requireUnchanged(row, await loadSource({ _id: row.user }, String(row.job), settings));
          if (await Application.exists({ _id: row.application, user: row.user, status: 'applied' })) throw new APIError(409, 'This application is already recorded as applied.');
          const changed = await AutoApplyAttempt.updateOne({ ...lease, submitStartedAt: null, leaseUntil: { $gt: new Date() } }, { $set: { submitStartedAt: new Date() } });
          if (!changed.matchedCount) throw new APIError(409, 'Submission was cancelled or the approval changed.');
          submitStarted = true;
        },
      });
      if (!['applied', 'blocked', 'unconfirmed'].includes(result.status) || (result.status === 'applied' && (!submitStarted || !result.confirmation))) throw new Error('Invalid submission result.');
      // A page error after clicking is not proof of rejection: the employer may
      // have accepted the POST before its response or client script failed.
      if (submitStarted && result.status === 'blocked') result.status = 'unconfirmed';
      if (result.status === 'applied') {
        const application = await recordApplicationEvidence(row.user, row.application, { key: `auto:${row.reviewToken}`, source: 'auto_apply', observedAt: new Date(),
          summary: result.confirmation, reference: row._id });
        if (!application) throw new Error('Could not record the submitted application.');
      }
      await AutoApplyAttempt.updateOne(lease, { $set: { status: result.status, confirmation: String(result.confirmation || '').slice(0, 500),
        error: String(result.reason || '').slice(0, 500), leaseToken: '', leaseUntil: new Date(0) } });
    }
    return { processed: 1 };
  } catch (error) {
    // Once the durable submit boundary is crossed, no exception is retryable.
    await AutoApplyAttempt.updateOne(lease, { $set: { status: submitStarted ? 'unconfirmed' : 'blocked', leaseToken: '', leaseUntil: new Date(0),
      error: submitStarted ? 'Submission may have reached the employer. Check the employer site or email before applying again.'
        : error.statusCode ? error.message.slice(0, 500) : 'The employer form could not be prepared. Use the employer website or try preparing again.',
    } });
    return { processed: 1, failed: true };
  }
}
