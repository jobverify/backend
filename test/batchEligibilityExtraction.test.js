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

test('structured preference fields cannot supply required experience', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('preferences must be filtered before model inference'));
  const requirement = '1 - 4 years of Sales/Business Development experience with B2B corporate sales experience';
  for (const text of [`preferredQualification:\n${requirement}`, `preferredQualification: ${requirement}`]) {
    const value = await extraction.extractBatchChunk({ endpoint: 'http://invalid.test' }, text, {});
    assert.equal(value.status, 'not_stated');
    assert.deepEqual(value.experienceRanges, []);
    for (const evidence of [requirement, text]) assert.throws(() => extraction.validateBatchExtraction({ status: 'supported',
      graduationYears: [], graduationMaxYear: null, graduationEvidence: [], experienceRanges: [{ minimumYears: 1,
        maximumYears: 4, isOpenEnded: false, alternative: false, evidence }] }, text));
  }
});

test('model decoding can only use quantities from the cited experience clause', async t => {
  let schema;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    schema = JSON.parse(options.body).response_format.json_schema.schema;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"ranges":[]}' } }] });
  });
  await extraction.extractBatchChunk({ endpoint: 'http://extractor.test' },
    'Required qualifications:\nApplicants need exactly 10 years of cybersecurity experience.\nHave no more than 18 months of professional experience.', {});
  const clauses = schema.properties.ranges.items.oneOf;
  assert.ok(Array.isArray(clauses), 'decoding must select a schema constrained to one source clause');
  assert.equal(clauses.length, 3);
  assert.deepEqual(clauses.map(clause => clause.properties.sourceId.enum), [[1], [2], [2]]);
  assert.deepEqual(clauses.map(clause => clause.properties.minimumYears.enum), [[10], [0], [1.5]]);
  assert.deepEqual(clauses.map(clause => clause.properties.maximumYears.enum), [[10], [1.5], [1.5]]);
});

test('a separate degree requirement does not turn experience into alternative degree routes', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ finish_reason: 'stop', message: {
    content: '{"ranges":[{"minimumYears":3,"maximumYears":5,"sourceId":2}]}' } }] }));
  const text = 'A bachelor degree or equivalent is required.\nApplicants must have 3-5 years of professional experience.';
  const value = extraction.validateBatchExtraction(await extraction.extractBatchChunk({ endpoint: 'http://extractor.test' }, text, {}), text);
  assert.equal(value.status, 'supported');
  assert.equal(value.experienceRanges[0].alternative, false);
});

test('decoding cannot mix a stated range with a separate minimum in the same clause', async t => {
  let schema;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    schema = JSON.parse(options.body).response_format.json_schema.schema;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"ranges":[]}' } }] });
  });
  await extraction.extractBatchChunk({ endpoint: 'http://extractor.test' },
    '6-8 years of experience, with a minimum of 5 years in Strategy or Management Consulting.', {});
  const clauses = schema.properties.ranges.items.oneOf;
  assert.deepEqual(clauses.map(clause => [clause.properties.minimumYears.enum, clause.properties.maximumYears.enum]), [[[6], [8]]]);
});

test('approximate experience cannot become an exact eligibility bound', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('approximate quantities cannot establish eligibility bounds'));
  const value = await extraction.extractBatchChunk({ endpoint: 'http://invalid.test' },
    'Significant experience (around 10 years or equivalent) in cybersecurity.', {});
  assert.equal(value.status, 'not_stated');
  assert.deepEqual(value.experienceRanges, []);
});

test('year quantities cannot borrow a unit from a later monthly subrequirement', async t => {
  let schema;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    schema = JSON.parse(options.body).response_format.json_schema.schema;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"ranges":[]}' } }] });
  });
  await extraction.extractBatchChunk({ endpoint: 'http://extractor.test' },
    'Years of experience: 3 to 5, including 6 months in leadership.', {});
  const pairs = schema.properties.ranges.items.oneOf.map(clause =>
    [clause.properties.minimumYears.enum[0], clause.properties.maximumYears.enum[0]]);
  assert.ok(pairs.some(([min, max]) => min === 3 && max === 5), 'the stated year range must remain selectable');
  assert.ok(pairs.every(pair => pair.every(value => [0.5, 3, 5].includes(value))), 'only source quantities with their own units may be used');
});

test('approximate team sizes do not suppress exact experience requirements', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ finish_reason: 'stop', message: {
    content: '{"ranges":[{"minimumYears":3,"maximumYears":3,"sourceId":1}]}' } }] }));
  const text = 'Applicants need 3 years of experience managing approximately 20 engineers.';
  const value = await extraction.extractBatchChunk({ endpoint: 'http://extractor.test' }, text, {});
  assert.equal(value.status, 'supported');
  assert.equal(extraction.validateBatchExtraction(value, text).experienceRanges[0].minimumYears, 3);
});
