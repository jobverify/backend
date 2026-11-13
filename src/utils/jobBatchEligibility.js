import { createHash } from 'node:crypto';
import { getSourceDescription } from './jobSourceContent.js';

export const BATCH_ELIGIBILITY_VERSION = 'academic-batches-v1';
export const validBatchYear = value => Number.isInteger(value) && value >= 1900 && value <= 2199;
export const batchYears = values => [...new Set((Array.isArray(values) ? values : []).filter(validBatchYear))].sort((a, b) => a - b);
export const batchMaximum = job => validBatchYear(job?.eligibleBatchRange?.maxYear) ? job.eligibleBatchRange.maxYear : null;

export function graduationAnchor(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = Number(parts.find(part => part.type === 'year').value);
  return year + (Number(parts.find(part => part.type === 'month').value) >= 8 ? 1 : 0);
}

export const normalizeBatchSource = value => String(value ?? '').replace(/\r\n?/g, '\n').trim();
export function batchSourceFields(job = {}) {
  return {
    title: normalizeBatchSource(job.originalTitle || job.title),
    description: normalizeBatchSource(getSourceDescription(job)),
    ...Object.fromEntries(['minimumQualification', 'preferredQualification', 'qualifications', 'requirements', 'responsibilities',
      'sourceEmploymentType', 'sourceExperienceRequired', 'sourceNativeExperienceConflict'].map(field => [field,
      field === 'sourceNativeExperienceConflict' ? job[field] || null : normalizeBatchSource(job[field])])),
    ...(job.experienceRequiredProvenance === 'source' ? { experienceRequired: normalizeBatchSource(job.experienceRequired) } : {}),
  };
}
export const batchHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const batchSourceHash = job => batchHash(batchSourceFields(job));

export function matchesBatchYear(job, year) {
  const selected = Number(year), maximum = batchMaximum(job);
  return validBatchYear(selected) && (batchYears(job.eligibleBatches).includes(selected) || (maximum !== null && selected <= maximum));
}
export const hasBatchEligibility = job => batchYears(job.eligibleBatches).length > 0 || batchMaximum(job) !== null;
export function formatBatchEligibility(job, { markEstimate = false } = {}) {
  const maximum = batchMaximum(job);
  const years = batchYears(job.eligibleBatches).filter(year => maximum === null || year > maximum);
  const value = [maximum === null ? '' : `${maximum} and earlier`, years.join(', ')].filter(Boolean).join('; ');
  return value && markEstimate && job.eligibleBatchesProvenance === 'inferred' ? `${value} (estimated)` : value;
}
export const batchYearExpression = year => ({ $or: [
  { $in: [year, { $ifNull: ['$eligibleBatches', []] }] },
  { $and: [{ $isNumber: '$eligibleBatchRange.maxYear' }, { $gte: ['$eligibleBatchRange.maxYear', year] }] },
] });
export const batchYearFilter = years => ({ $or: [
  { eligibleBatches: { $in: years } }, { 'eligibleBatchRange.maxYear': { $gte: Math.min(...years) } },
] });

// Called with the effective employer content after partial-listing retention.
export function batchRescrapePatch(job, previous) {
  if (!previous?.batchEligibility) return {};
  if (batchSourceHash(job) === previous.batchEligibility.sourceHash) return {
    eligibleBatches: previous.eligibleBatches || [], eligibleBatchRange: previous.eligibleBatchRange || null,
    eligibleBatchesProvenance: previous.eligibleBatchesProvenance || null, batchEligibility: previous.batchEligibility,
    // A new native employer constraint supersedes a derived estimate even when text is unchanged.
    ...(job.eligibleBatchesProvenance === 'source' && (previous.eligibleBatchesProvenance !== 'source'
      || JSON.stringify(batchYears(job.eligibleBatches)) !== JSON.stringify(batchYears(previous.eligibleBatches))
      || batchMaximum(job) !== batchMaximum(previous)) ? {
      eligibleBatches: batchYears(job.eligibleBatches), eligibleBatchRange: job.eligibleBatchRange || null,
      eligibleBatchesProvenance: 'source', batchEligibility: { status: 'pending', reason: 'source_batches_changed' },
    } : {}),
  };
  return {
    eligibleBatches: job.eligibleBatchesProvenance === 'source' ? batchYears(job.eligibleBatches) : [],
    eligibleBatchRange: job.eligibleBatchesProvenance === 'source' ? job.eligibleBatchRange || null : null,
    eligibleBatchesProvenance: job.eligibleBatchesProvenance === 'source' ? 'source' : null,
    batchEligibility: { status: 'pending', reason: 'source_changed' },
  };
}
