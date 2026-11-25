import { createHash } from 'node:crypto';
import { getSourceDescription } from './jobSourceContent.js';

export const BATCH_ELIGIBILITY_VERSION = 'academic-batches-v3';
export const validBatchYear = value => Number.isInteger(value) && value >= 1900 && value <= 2199;
export const batchYears = values => [...new Set((Array.isArray(values) ? values : []).filter(validBatchYear))].sort((a, b) => a - b);
export const batchMaximum = job => validBatchYear(job?.eligibleBatchRange?.maxYear) ? job.eligibleBatchRange.maxYear : null;
export const isPreferredBatchSection = value => /^(?:preferred|desirable|optional)(?:\s+(?:[a-z]+\s+){0,3}(?:qualifications?|requirements?|experience|skills|education)\b|\s*(?::|$))/i
  .test(String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').trim());

// "Graduate" in a role/degree name does not make nearby recruitment or
// legislation dates graduation years. Keep candidate graduation predicates
// even when ordinary date qualifiers separate the verb from its year.
export const hasGraduationYearEvidence = value => {
  const text = String(value ?? '');
  return /\b(?:19|20|21)\d{2}\b/.test(text)
    && (/\b(?:batches|batch|cohorts?|class\s+of|graduat(?:ion|ing|ed|es)|pass[- ]?outs?)\b/i.test(text)
      || /\b(?:19|20|21)\d{2}\s+graduate\b/i.test(text)
      || /\bgraduate\s+(?:(?:of|in|from|year|batch|only)\s+)*(?:19|20|21)\d{2}\b/i.test(text)
      || /\bgraduate\s+(?:of|in|from|by|during|before|after|with|on|between)\b[^.!?;\n]{0,80}\b(?:19|20|21)\d{2}\b/i.test(text)
      || /\b(?:who|to|will|must|should|shall|may|can|you|candidates?|applicants?|students?)\s+(?:(?:not|never|only|successfully)\s+){0,2}graduate\b[^.!?;\n]{0,80}\b(?:19|20|21)\d{2}\b/i.test(text));
};

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
export function formatBatchEligibility(job) {
  const maximum = batchMaximum(job);
  const years = batchYears(job.eligibleBatches).filter(year => maximum === null || year > maximum);
  const value = [maximum === null ? '' : `${maximum} and earlier`, years.join(', ')].filter(Boolean).join('; ');
  return value;
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
