import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CLASSIFICATION_MODEL, buildClassificationInput } from '../src/services/jobClassificationPolicy.js';
import { GLICLASS_CONFIG } from '../src/services/postScrapeClassification.js';
import { saveDryRunSnapshot } from '../scraper-support/utils/saveToDB.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';

test('shared classification identity uses the pinned GLiClass model', () => {
  assert.equal(CLASSIFICATION_MODEL.model, 'knowledgator/gliclass-edge-v3.0');
  assert.equal(CLASSIFICATION_MODEL.revision, GLICLASS_CONFIG.revision);
  assert.deepEqual(GLICLASS_CONFIG.labels, ['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']);
  assert.equal(buildClassificationInput({ title: 'Engineer', description: 'Build software.' }).modelRevision, GLICLASS_CONFIG.revision);
});

test('display normalization preserves the employer input used by classification', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const source = { title: 'Software Development Engineer \u00a0II', company: 'Example',
    jobDescription: 'Full-time role requiring 3-5 years of professional experience.', postedAt: '2026-09-17' };
  const normalized = normalizeScrapedJob(source);
  assert.equal(normalized.title, 'Software Development Engineer II');
  assert.equal(buildClassificationInput(normalized, { now }).inputHash, buildClassificationInput(source, { now }).inputHash);
});

test('missing and oversized descriptions cannot be marked as complete input', () => {
  assert.equal(buildClassificationInput({ title: 'Intern' }).incomplete, true);
  assert.equal(buildClassificationInput({ title: 'Engineer', description: 'a'.repeat(262145) }).incomplete, true);
  assert.equal(buildClassificationInput({ title: 'Engineer', description: 'Build APIs.' }).incomplete, false);
});

test('scraper entry points contain no model startup dependency', () => {
  for (const file of ['scraper-support/runner.js', 'scripts/resilientLocalScrape.js', 'scraper-support/utils/saveToDB.js']) {
    assert.equal(/start\w*Worker|prepareLocal\w+/.test(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')), false, file);
  }
});

test('snapshot persistence never executes an inline model', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'source-only-snapshot-'));
  try {
    const jobs = await saveDryRunSnapshot([{ title: 'Engineer', company: 'Example', location: 'Bengaluru, India',
      country: 'India', description: 'Build software.', link: 'https://example.com/jobs/one' }], path.join(directory, 'jobs.json'), {
      enrichPublicExperience: false,
      classifier: { mode: 'policy', classifyJobs: async () => { throw new Error('inline model was invoked'); } },
    });
    assert.equal(jobs.length, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
