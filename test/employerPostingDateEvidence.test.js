import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEmployerPostedAt } from '../src/utils/employerPostingDate.js';
import { sourcePublicationDateFields } from '../src/utils/jobPublicationDate.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';
const native = { postingDate: '2026-11-05', postedAt: '2026-11-05', sourceDateProvenance: 'workday-cxs-jobPostingInfo', sourceRawDates: { startDate: '2026-11-05', endDate: null }, postingDatePrecision: 'calendar-date', sourcePostingDateIsExact: false, sourceDetailComplete: true };
test('native employer dates require matching raw fields and precision', () => {
  assert.equal(resolveEmployerPostedAt(native)?.toISOString(), '2026-11-05T00:00:00.000Z');
  for (const patch of [{ sourceDateProvenance: undefined }, { postingDate: '2026-11-06', postedAt: '2026-11-06' }, { postingDatePrecision: 'timestamp' }, { sourceDetailComplete: false }, { sourceRawDates: { startDate: '2026-02-31' } }])
    assert.equal(resolveEmployerPostedAt({ ...native, ...patch }), null);
});
test('legacy source bookkeeping and observation dates cannot establish evidence', () => {
  for (const postedAtProvenance of ['source', 'observation', undefined])
    assert.equal(resolveEmployerPostedAt({ postedAt: '2026-11-05', postedAtProvenance, postedAtProvenanceValue: '2026-11-05T00:00:00.000Z' }), null);
});
test('explicit source enrichment marks an employer date and normalization retains native proof', () => {
  const fields = sourcePublicationDateFields('2026-11-05');
  assert.equal(fields.employerPostedAt, '2026-11-05T00:00:00.000Z');
  assert.equal(resolveEmployerPostedAt(fields)?.toISOString(), fields.employerPostedAt);
  assert.equal(resolveEmployerPostedAt({ ...fields, postedAtProvenance: 'observation' }), null);
  assert.equal(resolveEmployerPostedAt({ ...fields, postedAtProvenanceValue: '2026-11-06T00:00:00.000Z' }), null);
  const job = normalizeScrapedJob({ ...native, title: 'Engineer', company: 'Acme', location: 'Pune, India', sourceUrl: 'https://careers.example.test/engineer', description: 'Build systems.' });
  assert.equal(new Date(job.employerPostedAt).toISOString(), '2026-11-05T00:00:00.000Z');
});

test('explicit source enrichment rejects impossible calendar dates instead of rolling them over', () => {
  assert.throws(() => sourcePublicationDateFields('2026-02-31'), /valid lifecycle date/);
});

test('every supplied native date alias must be valid and agree with employer evidence', () => {
  assert.equal(resolveEmployerPostedAt({ ...native, employerPostedAt: '2026-11-06' }), null);
  assert.equal(resolveEmployerPostedAt({ ...native, employerPostedAt: '2026-02-31' }), null);
  const fields = sourcePublicationDateFields('2026-03-03');
  assert.equal(resolveEmployerPostedAt({ ...fields, postingDate: '2026-02-31' }), null);
});
