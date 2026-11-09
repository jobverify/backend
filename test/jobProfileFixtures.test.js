import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJobProfileFixtureJobs } from '../scripts/lib/jobProfileFixtures.js';
import { buildPublishableJobPostedAtCutoff } from '../src/utils/jobLifecycle.js';
import { normalizePublicJobCategory } from '../src/utils/publicJobNormalization.js';
import { hasSourceDescription } from '../src/utils/jobSourceContent.js';
import { isAggregateHiringSignalJob } from '../src/utils/jobListingEvidence.js';

const TIMESTAMP_FIELDS = ['postedAt', 'sortDate', 'scrapedAt', 'scrapedTimestamp', 'lastSeenAt', 'createdAt', 'updatedAt', 'extractedAt'];
const REFERENCE_DATE = new Date('2026-11-02T08:00:00.000Z');
const fixed = buildJobProfileFixtureJobs();

test('fixtures retain their fixed profiling dates when no reference clock is supplied', () => {
  assert.equal(fixed.length, 1800);
  assert.equal(fixed[0].postedAt.toISOString(), '2026-07-18T08:00:00.000Z');
  assert.equal(Math.max(...fixed.map(job => +job.postedAt)), +new Date('2026-07-22T08:59:00.000Z'));
  assert.deepEqual(buildJobProfileFixtureJobs({ referenceDate: undefined }), fixed);
});

test('an explicit reference clock moves every timestamp together while preserving data and ordering', () => {
  const original = buildJobProfileFixtureJobs({ totalJobs: 1850 });
  const rolling = buildJobProfileFixtureJobs({ totalJobs: 1850, referenceDate: REFERENCE_DATE });
  const shift = +REFERENCE_DATE - +new Date('2026-07-22T08:59:00.000Z');
  const content = job => Object.fromEntries(Object.entries(job).filter(([field]) => !TIMESTAMP_FIELDS.includes(field)));

  assert.equal(rolling.length, original.length);
  assert.equal(Math.max(...rolling.map(job => +job.postedAt)), +REFERENCE_DATE);
  assert.equal(REFERENCE_DATE.toISOString(), '2026-11-02T08:00:00.000Z');
  for (let index = 0; index < original.length; index += 1) {
    assert.deepEqual(content(rolling[index]), content(original[index]));
    for (const field of TIMESTAMP_FIELDS) {
      assert.equal(+rolling[index][field] - +original[index][field], shift, `${index}.${field}`);
    }
  }
  const orderedIds = jobs => [...jobs].sort((left, right) => +left.sortDate - +right.sortDate || left.jobId.localeCompare(right.jobId)).map(job => job.jobId);
  assert.deepEqual(orderedIds(rolling), orderedIds(original));
  assert.ok(rolling.some(job => job.status === 'expired'));
  assert.ok(rolling.some(job => job.status === 'hidden'));
  assert.equal(fixed[0].postedAt.toISOString(), '2026-07-18T08:00:00.000Z');
});

test('rolling fixtures provide current public inventory across categories and companies', () => {
  const rolling = buildJobProfileFixtureJobs({ referenceDate: REFERENCE_DATE });
  const cutoff = buildPublishableJobPostedAtCutoff(REFERENCE_DATE);
  const categories = ['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract'];
  const visible = rolling.filter(job => job.status === 'active' && job.isPublicIndia
    && +job.postedAt >= +cutoff && +job.postedAt <= +REFERENCE_DATE
    && hasSourceDescription(job) && !isAggregateHiringSignalJob(job)
    && categories.includes(normalizePublicJobCategory(job)));

  assert.equal(cutoff.toISOString(), '2026-10-02T00:00:00.000Z');
  assert.equal(visible.length, 1721);
  assert.equal(new Set(visible.map(job => job.company)).size, 1242);
  assert.deepEqual(Object.fromEntries(categories.map(category => [category,
    visible.filter(job => normalizePublicJobCategory(job) === category).length,
  ])), { Intern: 144, 'Full-time Fresher': 143, 'Full-time Experienced': 1004, Contract: 430 });
});

test('reference clocks reject invalid Date values and unsupported inputs', () => {
  for (const referenceDate of [null, new Date('invalid'), '2026-11-02T08:00:00.000Z', 0]) {
    assert.throws(() => buildJobProfileFixtureJobs({ referenceDate }), { name: 'TypeError', message: /referenceDate.*valid Date/ });
  }
});

test('reference clocks cannot produce out-of-range historical timestamps', () => {
  assert.throws(() => buildJobProfileFixtureJobs({ referenceDate: new Date(-8_640_000_000_000_000) }),
    { name: 'RangeError', message: /fixture timestamps/ });
});
