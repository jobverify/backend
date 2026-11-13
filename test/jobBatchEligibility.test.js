import assert from 'node:assert/strict';
import test from 'node:test';
import { graduationAnchor, batchSourceHash, batchRescrapePatch, formatBatchEligibility, matchesBatchYear } from '../src/utils/jobBatchEligibility.js';
import { batchEligibilityInput, resolveBatchEligibility } from '../src/services/jobBatchEligibility.js';
import { validateBatchExtraction, batchExtractionChunks } from '../src/services/batchEligibilityExtraction.js';
import { buildClassificationInput } from '../src/services/jobClassificationPolicy.js';

const now = new Date('2026-11-13T00:00:00Z');
const resolve = job => resolveBatchEligibility(batchEligibilityInput(job, { now }));
const engineer = { title: 'Software Engineer', sourceDescription: 'Minimum 3-5 years of professional experience required. Build production services.' };
const abstention = { status: 'not_stated', graduationYears: [], graduationMaxYear: null, graduationEvidence: [], experienceRanges: [] };
const extracted = (evidence, overrides = {}) => ({ ...abstention, status: 'supported', experienceRanges: [
  { minimumYears: 3, maximumYears: 5, isOpenEnded: false, alternative: false, evidence, ...overrides },
] });

test('academic anchor rolls over at August 1 in Kolkata and remains stable in January', () => {
  assert.equal(graduationAnchor(new Date('2027-07-31T18:29:59Z')), 2027);
  assert.equal(graduationAnchor(new Date('2027-07-31T18:30:00Z')), 2028);
  assert.equal(graduationAnchor(new Date('2026-12-31T18:29:59Z')), 2027);
  assert.equal(graduationAnchor(new Date('2026-12-31T18:30:00Z')), 2027);
});

test('category defaults apply to intern and fresher, with source graduation constraints taking precedence', () => {
  for (const job of [
    { title: 'Engineering Intern', sourceDescription: 'Currently pursuing a bachelor degree. Build software with the team.' },
    { title: 'Graduate Engineer', sourceDescription: 'Fresh graduates are welcome. No prior experience is required.' },
  ]) {
    assert.deepEqual(resolve(job).eligibleBatches, [2027]);
    const explicit = resolve({ ...job, eligibleBatches: [2025, 2026], eligibleBatchesProvenance: 'source' });
    assert.deepEqual(explicit.eligibleBatches, [2025, 2026]);
    assert.equal(explicit.status, 'explicit');
  }
  assert.deepEqual(resolve({ ...engineer, sourceDescription: 'Candidates from the 2024-2026 graduation batch are eligible.' }).eligibleBatches, [2024, 2025, 2026]);
  assert.deepEqual(resolve({ ...engineer, sourceDescription: 'Candidates from batch 2025 and 2026 are eligible.' }).eligibleBatches, [2025, 2026]);
  assert.deepEqual(resolve({ ...engineer, sourceDescription: 'Posted in 2026. Candidates from the class of 2027 are eligible.' }).eligibleBatches, [2027]);
  assert.deepEqual(resolve({ title: 'Engineering Intern', sourceDescription: 'Currently pursuing a degree.\nPreferred qualifications:\n2028 graduates preferred.' }).eligibleBatches, [2027]);
});

test('employer experience supplies bounded, fractional and open batch eligibility across categories', () => {
  assert.deepEqual(resolve(engineer).eligibleBatches, [2022, 2023, 2024]);
  assert.deepEqual(resolve({ ...engineer, sourceEmploymentType: 'Contract', sourceExperienceRequired: '0-2 years',
    sourceDescription: 'Required: 0-2 years of professional experience. Build production services.' }).eligibleBatches, [2025, 2026, 2027]);
  assert.deepEqual(resolve({ ...engineer, sourceDescription: 'Required: 1.5-2.5 years of professional experience.' }).eligibleBatches, [2025, 2026]);
  const input = batchEligibilityInput(engineer, { now });
  assert.deepEqual(resolveBatchEligibility({ ...input, jobType: 'Unspecified' }).eligibleBatches, [2022, 2023, 2024]);
  const open = resolve({ ...engineer, sourceDescription: 'At least 3 years of professional experience is required.' });
  assert.deepEqual(open.eligibleBatchRange, { maxYear: 2024 });
  assert.deepEqual(open.eligibleBatches, []);
  assert.equal(formatBatchEligibility(open, { markEstimate: true }), '2024 and earlier (estimated)');
  assert.equal(matchesBatchYear(open, 2023), true);
  assert.equal(matchesBatchYear(open, 2025), false);
});

test('synthetic experience, missing source and source conflicts never establish numeric batches', () => {
  const job = { title: 'Senior Engineer', sourceDescription: 'Design reliable systems and lead code reviews.',
    experienceProfile: { minimumYears: 1, maximumYears: 15, hasExplicitExperience: true, confidence: 'high' } };
  const input = batchEligibilityInput(job, { now });
  assert.equal(resolveBatchEligibility(input).needsExtraction, true);
  assert.equal(resolveBatchEligibility(input, abstention).status, 'unknown');
  assert.equal(resolve({ title: 'Engineer' }).status, 'unknown');
  assert.equal(resolveBatchEligibility({ ...input, sourceConflict: true }, extracted('3-5 years experience')).status, 'unknown');
});

test('ambiguous employer graduation constraints block category defaults until supported', () => {
  const input = batchEligibilityInput({ title: 'Engineering Intern', sourceDescription: 'Currently pursuing a degree. Graduating in 2027 or earlier.' }, { now });
  assert.equal(resolveBatchEligibility(input).needsExtraction, true);
  assert.equal(resolveBatchEligibility(input, abstention).status, 'unknown');
  const result = resolveBatchEligibility(input, { ...abstention, status: 'supported', graduationMaxYear: 2027,
    graduationEvidence: ['Graduating in 2027 or earlier.'] });
  assert.equal(result.eligibleBatchesProvenance, 'source');
  assert.deepEqual(result.eligibleBatchRange, { maxYear: 2027 });
});

test('extraction requires grounded required quantities and safely abstains on preference, conflict and invention', () => {
  const evidence = 'Applicants must have 3-5 years of professional experience.';
  assert.equal(validateBatchExtraction(extracted(evidence), evidence).status, 'supported');
  assert.throws(() => validateBatchExtraction(extracted(evidence, { minimumYears: 9 }), evidence));
  assert.throws(() => validateBatchExtraction(extracted(evidence, { maximumYears: 3 }), evidence));
  assert.throws(() => validateBatchExtraction(extracted(evidence), 'Build systems.'));
  const preferred = '3-5 years of experience is preferred.';
  assert.throws(() => validateBatchExtraction(extracted(preferred), preferred));
  assert.throws(() => validateBatchExtraction(extracted(evidence), `Preferred qualifications:\n${evidence}`));
  assert.deepEqual(validateBatchExtraction({ ...extracted(evidence), status: 'not_stated' }, evidence), abstention);
  const alternative = 'A bachelor degree and 3-5 years of experience, or a master degree and 1-2 years of experience.';
  const routes = { ...extracted(alternative, { alternative: true }), experienceRanges: [
    ...extracted(alternative, { alternative: true }).experienceRanges,
    { minimumYears: 1, maximumYears: 2, isOpenEnded: false, alternative: true, evidence: alternative },
  ] };
  assert.equal(validateBatchExtraction(routes, alternative).experienceRanges.length, 2);
  const conflicting = { ...routes, experienceRanges: routes.experienceRanges.map(range => ({ ...range, alternative: false })) };
  assert.equal(validateBatchExtraction(conflicting, alternative).status, 'conflicting');
  const upper = 'Have no more than two years of professional work experience';
  assert.equal(validateBatchExtraction(extracted(upper, { minimumYears: 0, maximumYears: 2 }), upper).status, 'supported');
});

test('long-source extraction covers the full source rather than truncating later evidence', () => {
  const text = 'Required qualifications:\n' + 'Build services and collaborate. '.repeat(1000) + 'Applicants need 3-5 years of professional experience.';
  const chunks = batchExtractionChunks(text);
  assert.ok(chunks.length > 2);
  assert.ok(chunks.at(-1).includes('Applicants need 3-5 years'));
  for (let offset = 0; offset < text.length; offset += 100) assert.ok(chunks.some(chunk => chunk.includes(text.slice(offset, offset + 100))));
});

test('re-scrapes preserve unchanged estimates and invalidate changed employer evidence', () => {
  const original = { ...engineer, ...resolve(engineer) };
  original.batchEligibility = { status: 'inferred', sourceHash: batchSourceHash(original) };
  const unchanged = batchRescrapePatch({ ...engineer, eligibleBatches: [] }, original);
  assert.deepEqual(unchanged.eligibleBatches, [2022, 2023, 2024]);
  const changed = batchRescrapePatch({ ...engineer, sourceDescription: 'Minimum 8 years of professional experience required.' }, original);
  assert.deepEqual(changed.eligibleBatches, []);
  assert.equal(changed.batchEligibility.status, 'pending');
  const explicit = batchRescrapePatch({ ...engineer, eligibleBatches: [2026], eligibleBatchesProvenance: 'source' }, original);
  assert.deepEqual(explicit.eligibleBatches, [2026]);
  assert.equal(explicit.eligibleBatchesProvenance, 'source');
});

test('inferred cohorts never become classification evidence or change its source hash', () => {
  const before = buildClassificationInput(engineer, { now });
  const after = buildClassificationInput({ ...engineer, eligibleBatches: [2027], eligibleBatchesProvenance: 'inferred',
    eligibleBatchRange: { maxYear: 2024 } }, { now });
  assert.deepEqual(after.eligibleBatches, []);
  assert.equal(after.eligibleBatchesProvenance, null);
  assert.equal(after.inputHash, before.inputHash);
});
