import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { buildDescriptionRepairPlan, validateDescriptionRepairPlan } from '../scripts/repairMissingSourceDescriptions.js';

const evidence = ({ source = 'viewzenlabs', jobType, siteSettings = {} } = {}) => {
  const now = new Date();
  const sourceUrl = source === 'unstop'
    ? 'https://unstop.com/jobs/operations-specialist-unstop-1780828'
    : 'https://www.viewzenlabs.com/careers';
  const job = { _id: new mongoose.Types.ObjectId(), source, jobId: 'controlled-operations-role',
    company: source === 'unstop' ? 'Unstop' : 'ViewZen Labs', title: 'Operations Specialist', originalTitle: 'Operations Specialist',
    sourceUrl, applyUrl: sourceUrl, sourceDescription: null, description: null, department: null,
    status: 'active', isPublicIndia: true, country: 'India', city: 'Chennai', location: 'Chennai, India',
    postedAt: new Date(+now - 86400000), postedAtProvenance: 'observation',
    postedAtProvenanceValue: new Date(+now - 86400000).toISOString(), updatedAt: new Date(+now - 3600000),
    ...(jobType === undefined ? {} : { jobType }) };
  const candidate = { ...job, sourceDescription: 'Maintain operational records and coordinate routine business activities.',
    ...(source === 'unstop' ? { sourceDetailComplete: true,
      sourceDateEvidence: 'unstop-canonical-amp-jobposting-and-visible-deadline-v1',
      postingDate: new Date(+now - 2 * 86400000).toISOString(), closingDate: new Date(+now + 86400000).toISOString(),
      sourceClosingDateIsExact: true } : { sourceDetailComplete: false, sourceDetailFailureKind: 'full-description-not-published' }) };
  return { jobs: [job], trials: [{ source, productionWrites: false, finishedAt: new Date(+now - 1000).toISOString(), jobs: [candidate] }], now, siteSettings };
};

for (const source of ['viewzenlabs', 'unstop']) {
  test(`description repair does not forecast public visibility for an unknown ${source} category`, () => {
    const input = evidence({ source });
    const before = JSON.stringify(input);
    const plan = buildDescriptionRepairPlan(input);
    assert.equal(plan.entries.length, 1);
    assert.equal(plan.entries[0].expectedVisible, false);
    assert.equal(plan.entries[0].update.$set.sourceDescription, input.trials[0].jobs[0].sourceDescription);
    assert.equal(JSON.stringify(input), before);
  });
}

test('description repair forecast respects the experienced-jobs visibility setting', () => {
  const plan = buildDescriptionRepairPlan(evidence({ jobType: 'Full-time Experienced', siteSettings: { experiencedJobsEnabled: false } }));
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].expectedVisible, false);
});

test('description repair continues to forecast qualified supported categories', () => {
  for (const jobType of ['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract']) {
    const plan = buildDescriptionRepairPlan(evidence({ jobType }));
    assert.equal(plan.entries[0].expectedVisible, true, jobType);
  }
  const earlyCareer = buildDescriptionRepairPlan(evidence({ jobType: 'Full-time Fresher', siteSettings: { experiencedJobsEnabled: false } }));
  assert.equal(earlyCareer.entries[0].expectedVisible, true);
});

test('temporary Mongo validates repaired unknown and disabled categories as private', { timeout: 120000 }, async () => {
  for (const options of [{ source: 'unstop' }, { jobType: 'Full-time Experienced', siteSettings: { experiencedJobsEnabled: false } }]) {
    const plan = buildDescriptionRepairPlan(evidence(options));
    const report = await validateDescriptionRepairPlan(plan);
    assert.equal(report.environment, 'temporary-local-mongodb');
    assert.equal(report.productionWrites, false);
    assert.equal(report.jobsRepaired, 1);
    assert.equal(report.visibleAfter, 0);
    assert.equal(report.correctlyPrivateAfter, 1);
  }
});
