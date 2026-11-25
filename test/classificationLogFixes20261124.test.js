import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cleanSourceText } from '../src/services/jobClassificationPolicy.js';
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js';
import { batchEligibilityInput, resolveBatchEligibility } from '../src/services/jobBatchEligibility.js';
import { extractBatchChunk } from '../src/services/batchEligibilityExtraction.js';

const { jobs } = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/classificationLogFixes20261124.json.gz', import.meta.url))));
const now = new Date('2026-11-24T00:00:00Z');
const prediction = label => ({ modelLabel: label, windows: 1, fullDescriptionCovered: true,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(value => [value, value === label ? .97 : .01])) });
const classify = (job, label = 'Full-time Experienced') => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' });

test('definition-list metadata keeps requisition dates separate from qualifications', () => {
  const text = cleanSourceText('<dl><dt>Job title</dt><dd>ACM/UP/003/2026</dd><dt>Qualification</dt><dd>Graduation</dd></dl>');
  assert.deepEqual(text.split('\n').map(line => line.trim()).filter(Boolean),
    ['Job title ACM/UP/003/2026', 'Qualification Graduation']);
});

test('definition-list graduation labels retain their associated eligible years', () => {
  for (const title of ['Analyst', 'Engineering Intern']) for (const label of ['Eligible graduation batch', 'Graduation Year']) {
    const job = { title, sourceDescription: `<p>Build reports and analyze performance.</p><dl><dt>${label}</dt><dd>2024</dd></dl>` };
    const result = resolveBatchEligibility(batchEligibilityInput(job, { now }));
    assert.equal(result.status, 'explicit', `${title}/${label}`);
    assert.deepEqual(result.eligibleBatches, [2024]);
  }
});

test('both archived Annapurna inputs resolve batches without extracting requisition years', () => {
  const fresher = resolveBatchEligibility(batchEligibilityInput(jobs['annapurnafinance:e22e'], { now }));
  assert.equal(fresher.status, 'inferred');
  assert.deepEqual(fresher.eligibleBatches, [2027]);
  const experienced = resolveBatchEligibility(batchEligibilityInput(jobs['annapurnafinance:e22f'], { now }));
  assert.equal(experienced.status, 'inferred');
  assert.deepEqual(experienced.eligibleBatchRange, { maxYear: 2025 });
  assert.deepEqual(experienced.eligibleBatches, []);
});

test('requisition metadata cannot invoke the graduation extractor', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('metadata dates are not graduation constraints'));
  for (const key of ['annapurnafinance:e22e', 'annapurnafinance:e22f']) {
    const source = jobs[key].sourceDescription;
    const text = cleanSourceText(source.slice(source.lastIndexOf('<dl>')));
    const result = await extractBatchChunk({ endpoint: 'http://extractor.test' }, text, {});
    assert.deepEqual(result.graduationYears, []);
    assert.equal(result.graduationMaxYear, null);
  }
});

test('an explicit graduation cohort remains authoritative beside requisition metadata', () => {
  const job = { ...jobs['annapurnafinance:e22f'],
    sourceDescription: jobs['annapurnafinance:e22f'].sourceDescription + '<p>Only the 2024 graduation batch is eligible.</p>' };
  const result = resolveBatchEligibility(batchEligibilityInput(job, { now }));
  assert.equal(result.status, 'explicit');
  assert.deepEqual(result.eligibleBatches, [2024]);
});

test('optional cohort fields and educational preference headings cannot restrict mandatory eligibility', () => {
  for (const fields of [{ preferredQualification: '2024 graduation batch.' },
    { sourceDescription: 'Preferred educational qualifications:\n2024 graduates.' },
    { sourceDescription: 'Preferred educational qualifications\n2024 graduates.' }]) {
    const job = { title: 'Analyst', sourceDescription: 'Build financial reports for customers.', ...fields };
    const result = resolveBatchEligibility(batchEligibilityInput(job, { now }));
    assert.notEqual(result.status, 'explicit');
    assert.notDeepEqual(result.eligibleBatches, [2024]);
  }
  const job = { title: 'Analyst', sourceDescription: 'Build financial reports for customers.',
    preferredQualification: '2028 graduation batch.', qualifications: 'Only the 2024 graduation batch is eligible.' };
  const result = resolveBatchEligibility(batchEligibilityInput(job, { now }));
  assert.equal(result.status, 'explicit');
  assert.deepEqual(result.eligibleBatches, [2024]);
});

test('graduation extraction ignores optional cohort fields without invoking the model', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('optional cohorts must not invoke graduation inference'));
  for (const fields of [{ preferredQualification: '2024 graduation batch.' },
    { sourceDescription: 'Preferred educational qualifications:\n2024 graduates.' },
    { sourceDescription: 'Preferred educational qualifications\n2024 graduates.' }]) {
    const job = { title: 'Analyst', sourceDescription: 'Build financial reports for customers.', ...fields };
    const result = await extractBatchChunk({ endpoint: 'http://extractor.test' }, batchEligibilityInput(job, { now }).text, {});
    assert.equal(result.status, 'not_stated');
    assert.deepEqual(result.graduationYears, []);
  }
});

test('graduation extraction restores mandatory scope after an optional heading without punctuation', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const facts = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.deepEqual(facts.map(fact => fact.text), ['Candidates must graduate in May 2024.']);
    return Response.json({ choices: [{ finish_reason: 'stop', message: {
      content: JSON.stringify({ years: [2024], maximumYear: null, sourceIds: [facts[0].id] }) } }] });
  });
  const result = await extractBatchChunk({ endpoint: 'http://extractor.test' },
    'Preferred qualifications\n2028 graduates.\nRequired qualifications\nCandidates must graduate in May 2024.', {});
  assert.deepEqual(result.graduationYears, [2024]);
});

test('a labeled minimum experience duration retains its open upper bound', () => {
  for (const [text, minimum] of [['Experience: Minimum 2 years in Micro-finance', 2],
    ['Experience:\nAt least 18 months in loan operations', 1.5]]) {
    const job = { title: 'Credit Analyst', sourceDescription: text };
    const profile = classify(job).resolved.employerExperienceProfile;
    assert.equal(profile.minimumYears, minimum);
    assert.equal(profile.maximumYears, null);
    assert.equal(profile.isOpenEnded, true);
  }
  const profile = classify({ title: 'Credit Analyst', sourceDescription: 'Experience: 2-6 years in Micro-finance' })
    .resolved.employerExperienceProfile;
  assert.equal(profile.minimumYears, 2);
  assert.equal(profile.maximumYears, 6);
  assert.equal(profile.isOpenEnded, false);
});

test('a title label cannot turn a repeated role caption into descriptive evidence', () => {
  const job = jobs['btgroupindia:c0e5'];
  assert.equal(postScrapeInput(job, { now }).incomplete, true);
  assert.equal(postScrapeInput({ ...job, sourceExperienceRequired: '3 years' }, { now }).incomplete, false);
});

test('navigation-only content cannot create an experienced vacancy from a senior title', () => {
  const result = classify(jobs.emeritus, 'Full-time Fresher');
  assert.equal(result.resolved.jobType, 'Unspecified');
  assert.equal(result.status, 'uncertain');
  assert.ok(result.sourceQualityIssues.includes('missing_role_description'));
});

test('test placeholders and repeated labels cannot supply model-only eligibility', () => {
  assert.equal(postScrapeInput(jobs.providence, { now }).incomplete, true);
  const result = classify(jobs['kpmg:7a68']);
  assert.equal(result.resolved.jobType, 'Unspecified');
  assert.ok(result.sourceQualityIssues.includes('sparse_role_description'));
  assert.equal(classify({ title: 'Test Engineer', sourceDescription: 'Test software and report defects.' }).resolved.jobType,
    'Full-time Experienced');
});

test('financial duties involving commercial contracts do not establish contract employment', () => {
  const result = classify(jobs['btgroupindia:c0e3'], 'Contract');
  assert.notEqual(result.resolved.jobType, 'Contract');
  const ownContract = classify({ ...jobs['btgroupindia:c0e3'], sourceEmploymentType: 'Contract' }, 'Contract');
  assert.equal(ownContract.resolved.jobType, 'Contract');
});

test('contradictory no-experience copy and a positive experience field require review', () => {
  const job = jobs.solugenixindiaprivatelimited;
  const result = classify(job);
  assert.equal(result.resolved.jobType, 'Unspecified');
  assert.equal(result.status, 'uncertain');
  assert.ok(result.sourceQualityIssues.includes('conflicting_role_eligibility'));
  const batch = resolveBatchEligibility(batchEligibilityInput(job, { now }));
  assert.equal(batch.status, 'unknown');
  assert.deepEqual(batch.eligibleBatches, []);
  assert.equal(batch.eligibleBatchRange, null);
});

test('bulleted, labeled and structured mandatory waivers retain contradictory eligibility', () => {
  for (const fields of [{ sourceDescription: '- No prior experience is required.\nExperience: 3 years.' },
    { sourceDescription: 'Experience: No prior experience is required.\nExperience: 3 years.' },
    { sourceDescription: 'Experience: 3 years.', requirements: 'No prior experience is required.' },
    { sourceDescription: 'Experience: 3 years.', minimumQualification: 'No prior experience is required.' }]) {
    const job = { title: 'Analyst', ...fields };
    const result = classify(job);
    assert.equal(result.resolved.jobType, 'Unspecified', JSON.stringify(fields));
    assert.ok(result.sourceQualityIssues.includes('conflicting_role_eligibility'));
    const batch = resolveBatchEligibility(batchEligibilityInput(job, { now }));
    assert.equal(batch.status, 'unknown');
    assert.deepEqual(batch.eligibleBatches, []);
  }
});

test('text-extracted graduation outputs cannot feed back as native classification evidence', () => {
  const job = { title: 'Analyst', sourceDescription: 'Preferred work mode: Office\nOnly the 2024 graduation batch is eligible.' };
  const withOutput = { ...job, eligibleBatches: [2024], eligibleBatchesProvenance: 'source',
    batchEligibility: { mode: 'policy', status: 'explicit', basis: 'source_text' } };
  assert.equal(postScrapeInput(withOutput, { now }).inputHash, postScrapeInput(job, { now }).inputHash);
  assert.equal(batchEligibilityInput(withOutput, { now }).inputHash, batchEligibilityInput(job, { now }).inputHash);
  const native = postScrapeInput({ ...job, eligibleBatches: [2024], eligibleBatchesProvenance: 'source' }, { now });
  assert.deepEqual(native.eligibleBatches, [2024]);
});

test('conditional and domain-specific experience waivers do not contradict overall tenure', () => {
  for (const waiver of ['No prior mortgage experience is required.',
    'No prior experience is required for applicants with a master degree.',
    'No prior experience is required, unless you do not have a master degree.']) {
    const result = classify({ title: 'Analyst', sourceDescription: `${waiver}\nExperience: 3 years.` });
    assert.ok(!result.sourceQualityIssues.includes('conflicting_role_eligibility'), waiver);
  }
});

test('a contradictory fresher title produces one eligibility review reason', () => {
  const result = classify({ title: 'Fresher Analyst',
    sourceDescription: 'No prior experience is required.\nExperience: 3 years.' });
  assert.equal(result.resolved.jobType, 'Unspecified');
  assert.deepEqual(result.sourceQualityIssues, ['conflicting_role_eligibility']);
});

test('navigation words in real duties and independent native requirements remain usable', () => {
  const native = classify({ ...jobs.emeritus, sourceExperienceRequired: '3 years' });
  assert.equal(native.resolved.jobType, 'Full-time Experienced');
  const real = classify({ title: 'Privacy Analyst',
    sourceDescription: 'Maintain the privacy policy and review how our service stores customer data.' });
  assert.equal(real.resolved.jobType, 'Full-time Experienced');
  assert.deepEqual(real.sourceQualityIssues, []);
});

test('entry-level titles do not waive independent numeric work requirements', () => {
  for (const [key, minimum, maximum] of [['hitachienergy', 1, 2], ['citigroup', 1, 3]]) {
    const result = classify(jobs[key], 'Intern');
    assert.equal(result.resolved.jobType, 'Full-time Experienced');
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, minimum);
    assert.equal(result.resolved.employerExperienceProfile.maximumYears, maximum);
  }
});

test('short genuine duties still permit classification without inventing experience years', () => {
  const job = { title: 'Cloud Engineer', sourceDescription: 'Protects cloud infrastructure and applications.' };
  const before = structuredClone(job);
  const result = classify(job);
  assert.equal(result.resolved.jobType, 'Full-time Experienced');
  assert.equal(result.resolved.experienceProfile.minimumYears, null);
  assert.deepEqual(job, before);
});
