import assert from 'node:assert/strict';
import test from 'node:test';
import { extractJobFilterSignals } from '../src/utils/jobFilterSignals.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';

const job = {
  title: 'Principal Engineer - Substation (Protection and Controls)',
  company: 'Example Engineering',
  location: 'India',
  sourceUrl: 'https://careers.example.com/principal-engineer',
};

test('main role experience is not replaced by a smaller specialty minimum', () => {
  const description = [
    'Qualifications and Experience',
    "Bachelor's degree in electrical engineering.",
    '14+ years of experience in substation protection and control design, preferably in a consulting environment.',
    'At least 2 years of experience in design and drafting electrical infrastructure in the UK.',
  ].join('\n');
  const normalized = normalizeScrapedJob({ ...job, description });
  assert.equal(normalized.experienceRequired, '14+ years');
  assert.equal(normalized.experienceProfile.minimumYears, 14);
  assert.equal(normalized.experienceProfile.isOpenEnded, true);
});

test('a required role range wins over a later narrower skill minimum', () => {
  const signals = extractJobFilterSignals({ ...job, description: [
    'Required qualifications',
    '8-12 years of professional experience in electrical engineering.',
    'At least 3 years of experience with ETAP software.',
  ].join('\n') });
  assert.equal(signals.experienceProfile.minimumYears, 8);
  assert.equal(signals.experienceProfile.maximumYears, 12);
});

test('preferred experience does not replace a lower required role minimum', () => {
  const normalized = normalizeScrapedJob({ ...job, description: [
    'Required qualifications: At least 5 years of professional experience.',
    'Preferred qualifications: 10+ years of experience in electrical engineering.',
  ].join('\n') });
  assert.equal(normalized.experienceRequired, '5+ years');
});

test('an explicit source experience requirement remains authoritative', () => {
  const normalized = normalizeScrapedJob({ ...job,
    experienceRequired: '6-8 years',
    sourceExperienceRequired: '6-8 years',
    description: 'At least 3 years of experience with CAD. Preferred: 10+ years of professional experience.',
  });
  assert.equal(normalized.experienceRequired, '6-8 years');
});

test('company experience before required qualifications does not become the candidate minimum', () => {
  const normalized = normalizeScrapedJob({ ...job, description: [
    'Example Engineering brings 30 years of experience in engineering consultancy.',
    'Required qualifications: At least 5 years of professional experience.',
    'At least 2 years of experience with CAD.',
  ].join('\n') });
  assert.equal(normalized.experienceRequired, '5+ years');
});

test('a required qualification field is not replaced by narrower description requirements', () => {
  const normalized = normalizeScrapedJob({ ...job,
    minimumQualification: 'At least 8 years of experience in engineering.',
    description: 'At least 2 years of experience with CAD. At least 1 year of experience with ETAP.',
  });
  assert.equal(normalized.experienceRequired, '8+ years');
  assert.equal(normalized.experienceProfile.minimumYears, 8);
});

test('an inline preferred clause does not become the required role minimum', () => {
  const normalized = normalizeScrapedJob({ ...job, description: 'Required qualifications: 10 years of experience in consulting preferred. At least 5 years of experience in engineering. At least 2 years of experience with CAD.' });
  assert.equal(normalized.experienceRequired, '5+ years');
  assert.equal(normalized.experienceProfile.minimumYears, 5);
});

test('alternative degree paths retain their requirements instead of adopting a specialty minimum', () => {
  const normalized = normalizeScrapedJob({ ...job, description: 'Required qualifications: Bachelor degree with 8 years of experience or Master degree with 6 years of experience. At least 2 years of experience with CAD.' });
  assert.equal(normalized.experienceProfile.minimumYears, null);
  assert.equal(normalized.experienceProfile.maximumYears, null);
  assert.deepEqual(normalized.experienceYears, []);
  assert.match(normalized.experienceRequired, /8 years of experience or Master degree with 6 years/);
});
