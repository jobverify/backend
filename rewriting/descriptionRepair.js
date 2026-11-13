import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { buildRewriteInput, buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js';
import { publicDescriptionFields } from '../src/utils/jobDescriptionDisplay.js';
import { assessDescriptionSource } from '../src/utils/jobDescriptionSourceQuality.js';
import { extractJobDetail } from '../scraper/volkswagengrouptechnologysolutionsindia/script.js';

const snapshotFields = ['status', 'title', 'originalTitle', 'company', 'source', 'jobId', 'sourceUrl',
  'minimumQualification', 'preferredQualification', 'sourceEmploymentType', 'sourceExperienceRequired', 'location', 'salary',
  'description', 'descriptionFormat', 'sourceDescription', 'sourceContentHash', 'sourceContentHashVersion',
  'descriptionRewrite.status', 'descriptionRewrite.inputHash', 'descriptionRewrite.policyVersion', 'updatedAt'];
const fieldValue = (object, field) => field.split('.').reduce((value, key) => value?.[key], object);
const payload = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const titleKey = value => String(value ?? '').replace(/\s*\|\s*Ascendion\s*$/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
const nativeKinds = new Set(['native_source', 'quarantine']);

export const descriptionRepairHash = plan => createHash('sha256').update(JSON.stringify({ ...plan, hash: undefined })).digest('hex');

export function verifiedNativeDescription(job, evidence) {
  if (!evidence || evidence.status !== 200) return null;
  if (job.source === 'ascendion') {
    const expected = `https://jobs.ascendion.com/api/pcsx/position_details?position_id=${encodeURIComponent(job.jobId)}&domain=ascendion.com&hl=en`;
    const data = evidence.body?.data || evidence.body;
    if (evidence.url !== expected || String(data?.id) !== String(job.jobId) || titleKey(data.name) !== titleKey(job.originalTitle || job.title)) {
      throw new Error('Native description identity mismatch');
    }
    return typeof data.jobDescription === 'string' ? data.jobDescription : null;
  }
  if (job.source === 'volkswagengrouptechnologysolutionsindia') {
    if (evidence.url !== job.sourceUrl || typeof evidence.body !== 'string') throw new Error('Native description URL mismatch');
    const detail = extractJobDetail(evidence.body);
    if (!detail.sourceDescription) return null;
    if (String(detail.requisitionId) !== String(job.jobId) || titleKey(detail.title) !== titleKey(job.title)) throw new Error('Native description identity mismatch');
    return detail.sourceDescription || null;
  }
  throw new Error('Unsupported native description recovery');
}

export function buildDescriptionRepairPlan(jobs, { nativeEvidence = {}, now = new Date() } = {}) {
  const rows = [], seen = new Set();
  for (const job of jobs) {
    const id = String(job._id);
    if (!/^[a-f\d]{24}$/i.test(id) || seen.has(id)) throw new Error('Invalid or duplicate repair identity');
    seen.add(id);
    if (job.status !== 'active') continue;
    const contaminated = !assessDescriptionSource(job.sourceDescription ?? job.description).ok;
    let set, kind;
    if (contaminated) {
      const source = verifiedNativeDescription(job, nativeEvidence[id]);
      if (source && assessDescriptionSource(source).ok) {
        const candidate = { ...job, sourceDescription: source };
        const input = buildRewriteInput(candidate);
        set = buildDescriptionSourceUpdate(candidate, job, { mode: 'publish', now });
        if (set.sourceContentHash !== input.inputHash || !set.description) throw new Error('Native description recovery is incomplete');
        kind = 'native_source';
      } else {
        if (job.description == null && job.descriptionRewrite?.status === 'skipped'
          && job.descriptionRewrite.reason === 'non_job_source_content') continue;
        kind = 'quarantine';
        set = { description: null, descriptionFormat: 'plain', descriptionRewrite: {
          ...job.descriptionRewrite, status: 'skipped', reason: 'non_job_source_content', nextAttemptAt: null,
        } };
      }
      set['postClassification.status'] = 'pending';
      set['postClassification.reason'] = 'source_description_repaired';
    } else {
      if (typeof job.description !== 'string' || !job.description.trim()) continue;
      const display = publicDescriptionFields(job);
      if (typeof display.description !== 'string' || display.description === job.description) continue;
      // This operational path repairs layout only. HTML conversion or a wording
      // replacement requires separately verified employer-source evidence.
      if (payload(display.description) !== payload(job.description)) continue;
      kind = 'layout';
      set = display;
    }
    set.updatedAt = now.toISOString();
    const snapshot = snapshotFields.map(field => {
      const value = fieldValue(job, field);
      return value === undefined ? { field, missing: true } : { field, value: value instanceof Date ? value.toISOString() : value };
    });
    rows.push({ id, title: job.title, company: job.company, kind, snapshot, set,
      unset: nativeKinds.has(kind) ? ['classification'] : [],
      ...(nativeEvidence[id] && { evidence: { url: nativeEvidence[id].url, status: nativeEvidence[id].status,
        sha256: createHash('sha256').update(JSON.stringify(nativeEvidence[id].body)).digest('hex') } }) });
  }
  const plan = { version: 1, createdAt: now.toISOString(), rows };
  return { ...plan, hash: descriptionRepairHash(plan) };
}

const restoreDates = value => {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
    /^(?:updatedAt|queuedAt|publishedAt|attemptedAt|nextAttemptAt)$/.test(key) && typeof child === 'string' && /^\d{4}-\d\d-\d\dT/.test(child)
      ? new Date(child) : child && typeof child === 'object' && !Array.isArray(child) ? restoreDates(child) : child]));
};

export async function applyDescriptionRepairPlan(collection, plan, { backup, now = new Date() } = {}) {
  if (plan.version !== 1 || plan.hash !== descriptionRepairHash(plan) || typeof backup !== 'function'
    || !Number.isFinite(Date.parse(plan.createdAt)) || +now < Date.parse(plan.createdAt) || +now - Date.parse(plan.createdAt) > 86400000) {
    throw new Error('Invalid, changed, or expired description repair plan');
  }
  const allowed = new Set(['description', 'descriptionFormat', 'updatedAt', 'sourceDescription', 'sourceContentHash', 'sourceContentHashVersion',
    'descriptionRewrite', 'postClassification.status', 'postClassification.reason']);
  const results = [];
  const ids = new Set();
  for (const row of plan.rows) {
    if (!/^[a-f\d]{24}$/i.test(row.id) || ids.has(row.id.toLowerCase()) || !['layout', 'native_source', 'quarantine'].includes(row.kind)
      || !Array.isArray(row.snapshot) || row.snapshot.length !== snapshotFields.length
      || !snapshotFields.every((field, index) => row.snapshot[index].field === field)
      || Object.keys(row.set).some(key => !allowed.has(key)) || row.unset.some(key => key !== 'classification')
      || (row.kind === 'layout' && (row.unset.length || Object.keys(row.set).some(key => !['description', 'descriptionFormat', 'updatedAt'].includes(key))))) {
      throw new Error('Repair plan contains unsupported changes');
    }
    ids.add(row.id.toLowerCase());
  }
  for (const row of plan.rows) {
    const filter = { _id: new Types.ObjectId(row.id), status: 'active', $expr: { $and: row.snapshot.map(item => item.missing
      ? { $eq: [{ $type: '$' + item.field }, 'missing'] }
      : { $eq: ['$' + item.field, { $literal: item.field === 'updatedAt' ? new Date(item.value) : item.value }] }) } };
    const before = await collection.findOne(filter);
    if (!before) { results.push({ id: row.id, kind: row.kind, status: 'conflict' }); continue; }
    await backup({ id: row.id, planHash: plan.hash, before, set: row.set, unset: row.unset });
    const update = { $set: restoreDates(row.set), ...(row.unset.length && { $unset: Object.fromEntries(row.unset.map(field => [field, ''])) }) };
    const result = await collection.updateOne(filter, update);
    results.push({ id: row.id, kind: row.kind, status: result.matchedCount ? 'applied' : 'conflict' });
  }
  return { planHash: plan.hash, applied: results.filter(row => row.status === 'applied').length,
    conflicts: results.filter(row => row.status === 'conflict').length, results };
}
