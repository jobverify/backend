import assert from 'node:assert/strict';
import test from 'node:test';
import * as extraction from '../src/services/batchEligibilityExtraction.js';

test('simple source minimums retain an open upper bound without model inference', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('unnecessary model inference for an explicit minimum'));
  for (const [text, minimumYears] of [
    ['At least 3 years of professional experience is required.', 3],
    ['A minimum of three years of work experience is required.', 3],
    ['3+ years of professional experience.', 3],
    ['At least 18 months of professional experience is required.', 1.5],
  ]) {
    const value = await extraction.extractBatchChunk({ endpoint: 'http://invalid.test' }, `Required qualifications:\n${text}`, {});
    assert.deepEqual(value, { status: 'supported', graduationYears: [], graduationMaxYear: null, graduationEvidence: [],
      experienceRanges: [{ minimumYears, maximumYears: null, isOpenEnded: true, alternative: false, evidence: text }] });
    assert.deepEqual(extraction.validateBatchExtraction(value, text), value);
  }
});

test('preferences and company history cannot become deterministic minimums', async () => {
  for (const text of [
    'Preferred qualifications:\nAt least 3 years of professional experience is required.',
    'About us:\nOur company has at least 3 years of experience delivering software.',
  ]) {
    const value = await extraction.extractBatchChunk({ endpoint: 'http://invalid.test' }, text, {});
    assert.equal(value.status, 'not_stated');
    assert.deepEqual(value.experienceRanges, []);
  }
});

test('ambiguous or bounded clauses still use model extraction and retain source validation', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ ranges: [] }) } }] });
  });
  for (const text of [
    'At least 3 years and no more than 5 years of professional experience is required.',
    'At least 3-5 years of professional experience is required.',
    'At least 3 years of experience is preferred or 2 years is acceptable.',
    'At least 3 years of professional experience or a master degree is required.',
    'Between three and five years of professional experience is required.',
    'At least 3 years of professional experience is required.\nBetween three and five years of professional experience is required.',
    'A bachelor degree or a master degree is required.\nAt least 3 years of professional experience is required.',
  ]) {
    const before = requests;
    const value = await extraction.extractBatchChunk({ endpoint: 'http://extractor.test' }, `Required qualifications:\n${text}`, {});
    // Explicit preferences are excluded before either extraction path.
    assert.equal(requests - before, /preferred/.test(text) ? 0 : 1, text);
    assert.equal(value.status, 'not_stated');
  }
});

test('startup validation failures expose the expected and actual sample result', async () => {
  const wrong = { status: 'not_stated', graduationYears: [], graduationMaxYear: null, graduationEvidence: [], experienceRanges: [] };
  await assert.rejects(extraction.validateBatchExtractor({ extract: async () => wrong }), error => {
    assert.equal(error.validationFailure?.sampleId, 'required-range');
    assert.equal(error.validationFailure.actual.status, 'not_stated');
    assert.equal(error.validationFailure.expected.experienceRanges[0].minimumYears, 3);
    return true;
  });
});


test('quoted minimums repair repeated endpoints but reject requirement negation', () => {
  for (const [evidence, minimumYears] of [
    ['At least 3 years of professional experience is required.', 3],
    ['Minimum of four years of professional experience.', 4],
    ['Applicants need 2.5+ years of professional experience.', 2.5],
    ['Applicants need 5 years or more of professional experience.', 5],
    ['Applicants need 6 years and above of professional experience.', 6],
    ['At least 18 months of professional experience is required.', 1.5],
  ]) {
    const input = { status: 'supported', graduationYears: [], graduationMaxYear: null, graduationEvidence: [],
      experienceRanges: [{ minimumYears, maximumYears: minimumYears, isOpenEnded: false, alternative: false, evidence }] };
    const value = extraction.validateBatchExtraction(input, evidence);
    assert.deepEqual(value.experienceRanges, [{ minimumYears, maximumYears: null, isOpenEnded: true, alternative: false, evidence }]);
    assert.equal(input.experienceRanges[0].maximumYears, minimumYears, 'validation must not mutate cached extraction inputs');
  }
  const evidence = 'At least 3 years of professional experience is not required.';
  assert.throws(() => extraction.validateBatchExtraction({ status: 'supported', graduationYears: [], graduationMaxYear: null, graduationEvidence: [],
    experienceRanges: [{ minimumYears: 3, maximumYears: 3, isOpenEnded: false, alternative: false, evidence }] }, evidence));
});
