import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js';
import { batchEligibilityInput, resolveBatchEligibility } from '../src/services/jobBatchEligibility.js';
import { extractBatchChunk, validateBatchExtraction } from '../src/services/batchEligibilityExtraction.js';

const now = new Date('2026-11-18T00:00:00Z');
const apprenticeship = 'Advertisement for Engagement of Non-Engineering Graduate BSc-Nursing Apprentices 2026-27 under Apprentice Act-1961';
const empty = { status: 'not_stated', graduationYears: [], graduationMaxYear: null, graduationEvidence: [], experienceRanges: [] };
const prediction = { modelLabel: 'Full-time Experienced', windows: 1, fullDescriptionCovered: true,
  scores: { 'Full-time Experienced': .42, 'Full-time Fresher': .28, Intern: .2, Contract: .1 } };
const description = 'Maintain production services, collaborate with delivery teams and document operating procedures.';

test('explicit dummy requisitions cannot become public vacancies through model fallback', () => {
  for (const title of ['dummy req for testing', 'Dummy Requisition for Testing', 'DUMMY_REQ_FOR_TESTING']) {
    const job = { title, sourceDescription: description };
    const before = structuredClone(job);
    const result = resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' });
    assert.equal(result.resolved.jobType, 'Unspecified', title);
    assert.equal(result.status, 'uncertain', title);
    assert.ok(result.sourceQualityIssues.includes('non_vacancy_test_posting'), title);
    assert.ok(result.reviewReasons.includes('non_vacancy_test_posting'), title);
    assert.deepEqual(job, before);
  }
});

test('real testing and requisition-management roles remain eligible for model fallback', () => {
  for (const title of ['System Test Engineer', 'Software Testing Engineer', 'Requisition Management Specialist',
    'Test Engineer for Requisition Systems']) {
    const result = resolvePostScrapeClassification({ title, sourceDescription: description }, prediction, { now, mode: 'policy' });
    assert.equal(result.resolved.jobType, 'Full-time Experienced', title);
    assert.ok(!result.sourceQualityIssues.includes('non_vacancy_test_posting'), title);
  }
});

test('graduate apprenticeship intake and statutory dates cannot trigger graduation extraction for missing descriptions', () => {
  for (const sourceDescription of ['', apprenticeship]) {
    const input = batchEligibilityInput({ title: apprenticeship, sourceDescription }, { now });
    assert.equal(input.sourceInput.incomplete, true);
    assert.deepEqual(resolveBatchEligibility(input), { eligibleBatches: [], eligibleBatchRange: null,
      eligibleBatchesProvenance: null, status: 'unknown', basis: 'not_stated', evidence: [] });
  }
});

test('intake dates do not block independent employer experience or explicit graduation cohorts', () => {
  const resolve = sourceDescription => resolveBatchEligibility(batchEligibilityInput({ title: apprenticeship, sourceDescription }, { now }));
  const experience = resolve('At least 3 years of professional experience is required.');
  assert.equal(experience.status, 'inferred');
  assert.deepEqual(experience.eligibleBatchRange, { maxYear: 2024 });
  const graduation = resolve('Candidates from batch 2024 are eligible.');
  assert.equal(graduation.status, 'explicit');
  assert.deepEqual(graduation.eligibleBatches, [2024]);
});

test('batch extraction abstains on graduate role names with intake dates without invoking a model', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('intake and statutory dates are not graduation-year evidence'));
  for (const text of [`title:\n${apprenticeship}`, 'Graduate Engineer Apprentice recruitment 2026-27.']) {
    assert.deepEqual(await extractBatchChunk({ endpoint: 'http://invalid.test' }, text, {}), empty);
  }
});

test('source validation rejects graduation years grounded only in an intake title', () => {
  for (const year of [1961, 2026]) {
    assert.throws(() => validateBatchExtraction({ ...empty, status: 'supported', graduationYears: [year],
      graduationEvidence: [apprenticeship] }, apprenticeship), { code: 'INVALID_BATCH_EXTRACTION' });
  }
});

test('explicit graduate cohorts remain usable in either word order and in titles', () => {
  for (const evidence of ['2024 graduates are eligible.', 'Graduates from 2024 are eligible.',
    'Candidates graduating in 2024 are eligible.', 'Candidates from the class of 2024 are eligible.']) {
    const value = { ...empty, status: 'supported', graduationYears: [2024], graduationEvidence: [evidence] };
    assert.deepEqual(validateBatchExtraction(value, evidence), value);
  }
  const result = resolveBatchEligibility(batchEligibilityInput({ title: '2024 graduates', sourceDescription: '' }, { now }));
  assert.equal(result.status, 'explicit');
  assert.deepEqual(result.eligibleBatches, [2024]);
});

test('graduation predicates with calendar qualifiers override category defaults and employer experience', async t => {
  let selectedYear;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ finish_reason: 'stop', message: {
    content: JSON.stringify({ years: [selectedYear], maximumYear: null, sourceIds: [1] }) } }] }));
  for (const [evidence, year] of [
    ['Only candidates who graduate in May 2028 are eligible.', 2028],
    ['Candidates expected to graduate in Summer 2027 are eligible.', 2027],
    ['Candidates must graduate during 2028.', 2028],
    ['Graduate by the end of May 2024.', 2024],
  ]) {
    selectedYear = year;
    const input = batchEligibilityInput({ title: 'Engineering Intern', sourceDescription: evidence }, { now });
    assert.equal(resolveBatchEligibility(input).needsExtraction, true, evidence);
    const value = validateBatchExtraction(await extractBatchChunk({ endpoint: 'http://extractor.test' }, evidence, {}), evidence);
    assert.deepEqual(value.graduationYears, [year], evidence);
    const result = resolveBatchEligibility(input, value);
    assert.equal(result.status, 'explicit', evidence);
    assert.deepEqual(result.eligibleBatches, [year], evidence);
  }
  const evidence = 'Only candidates who graduate in May 2024 are eligible.';
  const input = batchEligibilityInput({ title: 'Engineer',
    sourceDescription: `At least 3 years of professional experience is required. ${evidence}` }, { now });
  assert.equal(resolveBatchEligibility(input).needsExtraction, true);
  const result = resolveBatchEligibility(input, { ...empty, status: 'supported', graduationYears: [2024], graduationEvidence: [evidence] });
  assert.equal(result.status, 'explicit');
  assert.deepEqual(result.eligibleBatches, [2024]);
  assert.equal(result.eligibleBatchRange, null);
});

test('candidate graduation predicates retain constraints across ordinary date wording', () => {
  for (const evidence of [
    'Candidates must graduate on 15 May 2028 to be eligible.',
    'Eligible candidates must graduate between May 2028 and June 2029.',
    'Applicants who graduate no later than May 2028 are eligible.',
    'Students expected to graduate towards the end of 2028 are eligible.',
    'You must successfully graduate prior to May 2028.',
  ]) {
    const input = batchEligibilityInput({ title: 'Engineering Intern', sourceDescription: evidence }, { now });
    assert.equal(resolveBatchEligibility(input).needsExtraction, true, evidence);
    assert.equal(resolveBatchEligibility(input, empty).status, 'unknown', evidence);
  }
});
