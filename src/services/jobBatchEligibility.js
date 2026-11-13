import { buildClassificationInput, cleanSourceText } from './jobClassificationPolicy.js';
import { sourceGuardedClassification } from './postScrapeClassification.js';
import { batchHash, batchSourceFields, batchSourceHash, batchYears, batchMaximum, graduationAnchor,
  BATCH_ELIGIBILITY_VERSION } from '../utils/jobBatchEligibility.js';

export function batchEligibilityInput(job, { now = new Date(), mode = 'policy' } = {}) {
  const source = batchSourceFields(job), sourceHash = batchSourceHash(job);
  const text = Object.entries(source).filter(([, value]) => typeof value === 'string' && value)
    .map(([key, value]) => `${key}:\n${cleanSourceText(value)}`).join('\n\n');
  const saved = mode === 'shadow' ? job.postClassification?.result?.classification : job.classification;
  // Source guards protect numeric requirements even for jobs without a completed classification.
  const guarded = sourceGuardedClassification(job, { now, mode });
  const resolved = saved?.complete === true && saved.inputHash === guarded.inputHash ? saved.resolved : guarded.resolved;
  const jobType = resolved?.jobType || 'Unspecified';
  const profile = guarded.resolved?.employerExperienceProfile;
  const anchorYear = graduationAnchor(now);
  // Text-extracted graduation years are outputs; only native fields are inputs.
  const nativeYears = job.eligibleBatchesProvenance === 'source' && job.batchEligibility?.basis !== 'source_text'
    ? batchYears(job.eligibleBatches) : [];
  const nativeMaximum = job.eligibleBatchesProvenance === 'source' && job.batchEligibility?.basis !== 'source_text' ? batchMaximum(job) : null;
  const inputHash = batchHash({ sourceHash, jobType, profile, anchorYear, nativeYears, nativeMaximum, version: BATCH_ELIGIBILITY_VERSION });
  return { sourceHash, text, jobType, profile, anchorYear, nativeYears, nativeMaximum, inputHash,
    sourceConflict: Boolean(source.sourceNativeExperienceConflict),
    sourceInput: buildClassificationInput({ ...job, descriptionRewrite: null }, { now }) };
}

const supportedProfile = profile => profile?.hasExplicitExperience === true && profile.confidence !== 'low'
  && typeof profile.minimumYears === 'number' && profile.minimumYears >= 0 && profile.minimumYears <= 40
  && (profile.isOpenEnded === true || (typeof profile.maximumYears === 'number'
    && profile.maximumYears >= profile.minimumYears && profile.maximumYears <= 40));

// Only straightforward affirmative cohort statements bypass the model. Everything
// with exclusions, preferences or open bounds is interpreted by the extractor.
export function explicitSourceBatches(input) {
  const segments = []; let preferred = false;
  for (const line of input.text.split('\n')) {
    if (/^(?:preferred|desirable|optional)\s*(?:qualifications?|requirements?)?/i.test(line.trim())) preferred = true;
    else if (/^(?:required|minimum|basic|responsibilities|requirements|description|title)\b/i.test(line.trim())) preferred = false;
    if (!preferred) segments.push(...line.split(/[.!?;]/).filter(part => /\b(?:batches|batch|cohorts?|class\s+of|graduat(?:ion|ing|ed|es?)|pass[- ]?outs?)\b/i.test(part)
      && /\b(?:19|20|21)\d{2}\b/.test(part)));
  }
  if (!segments.length) return { years: [], ambiguous: false };
  if (segments.some(part => /\b(?:not|except|excluding|before|after|earlier|later|prior|preferred|desirable|by|since|between|above|newer|onwards?)\b/i.test(part))) return { years: [], ambiguous: true };
  const years = [];
  for (const segment of segments) {
    const groups = [
      /\b((?:19|20|21)\d{2}(?:\s*(?:,|\/|or|and|to|-|\u2013|\u2014)\s*(?:19|20|21)\d{2})*)\s+(?:graduation\s+)?(?:batches|batch|cohorts?|graduates?|pass[- ]?outs?)\b/gi,
      /\b(?:batches|batch|cohorts?|class\s+of|graduat(?:ing|ed|ion)(?:\s+(?:year|batch))?)\s*(?:(?:of|in|from|year|batch|only)\s*)?((?:19|20|21)\d{2}(?:\s*(?:,|\/|or|and|to|-|\u2013|\u2014)\s*(?:19|20|21)\d{2})*)\b/gi,
    ].flatMap(pattern => [...segment.matchAll(pattern)].map(match => match[1]));
    if (!groups.length) return { years: [], ambiguous: true };
    for (const group of groups) {
      const range = group.match(/\b((?:19|20|21)\d{2})\s*(?:-|\u2013|\u2014|to)\s*((?:19|20|21)\d{2})\b/i);
      if (range) {
        const min = Number(range[1]), max = Number(range[2]);
        if (max < min || max - min > 40) return { years: [], ambiguous: true };
        for (let year = min; year <= max; year++) years.push(year);
      } else years.push(...(group.match(/\b(?:19|20|21)\d{2}\b/g) || []).map(Number));
    }
  }
  return { years: batchYears(years), ambiguous: years.length === 0, evidence: segments };
}

export function resolveBatchEligibility(input, extraction) {
  const result = (years, maximum, provenance, basis, evidence = []) => ({
    eligibleBatches: batchYears(years).filter(year => maximum === null || year > maximum),
    eligibleBatchRange: maximum === null ? null : { maxYear: maximum }, eligibleBatchesProvenance: provenance,
    status: provenance === 'source' ? 'explicit' : provenance === 'inferred' ? 'inferred' : 'unknown', basis, evidence,
  });
  if (input.nativeYears.length || input.nativeMaximum !== null) return result(input.nativeYears, input.nativeMaximum, 'source', 'source_field');
  const source = explicitSourceBatches(input);
  if (source.years.length) return result(source.years, null, 'source', 'source_text', source.evidence);
  if (extraction?.status === 'conflicting') return result([], null, null, 'conflicting_source');
  if (extraction?.graduationYears?.length || extraction?.graduationMaxYear !== null && extraction?.graduationMaxYear !== undefined) {
    return result(extraction.graduationYears, extraction.graduationMaxYear, 'source', 'source_text', extraction.graduationEvidence);
  }
  if (source.ambiguous && !extraction) return { needsExtraction: true };
  if (source.ambiguous) return result([], null, null, 'unresolved_graduation_constraint');
  if (['Intern', 'Full-time Fresher'].includes(input.jobType)) return result([input.anchorYear], null, 'inferred', 'category_default');
  if (input.sourceConflict) return result([], null, null, 'conflicting_source');
  let ranges, evidence, basis;
  if (supportedProfile(input.profile)) {
    ranges = [input.profile]; evidence = [input.profile.evidence].filter(Boolean); basis = 'employer_experience';
  } else if (extraction?.experienceRanges?.length) {
    ranges = extraction.experienceRanges; evidence = ranges.map(range => range.evidence); basis = 'extracted_experience';
  } else if (!extraction && input.sourceInput.body && !input.sourceInput.incomplete) return { needsExtraction: true };
  else return result([], null, null, 'not_stated');
  const years = []; let maximum = null;
  for (const range of ranges) {
    const youngest = input.anchorYear - Math.floor(range.minimumYears);
    if (range.isOpenEnded) maximum = Math.max(maximum ?? -Infinity, youngest);
    else for (let year = input.anchorYear - Math.floor(range.maximumYears); year <= youngest; year++) years.push(year);
  }
  return result(years, maximum, 'inferred', basis, evidence);
}
