import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMainExperienceRepair } from '../src/services/mainExperienceRepair.js';
import { postScrapeInput } from '../src/services/postScrapeClassification.js';

const job = { _id: '665f47f5f65f3f4d2e1d1001', title: 'Principal Engineer', company: 'Example Engineering', source: 'example',
  sourceUrl: 'https://careers.example.com/engineer', applyUrl: 'https://careers.example.com/apply',
  experienceRequired: '2+ years', sourceExperienceRequired: null,
  sourceDescription: 'Required qualifications: 14+ years of professional experience. At least 2 years of experience with CAD.',
  postClassification: { mode: 'policy', status: 'completed', inputHash: 'old-source' },
};

test('stored inferred experience can be repaired with source guards and reclassification', () => {
  const repair = buildMainExperienceRepair(job);
  assert.equal(repair.next, '14+ years');
  assert.equal(repair.update.$set.experienceRequired, '14+ years');
  assert.equal(repair.update.$set.experienceProfile.minimumYears, 14);
  assert.deepEqual(repair.update.$set.experienceYears, [14, 15]);
  assert.equal(repair.update.$set.postClassification.status, 'pending');
  assert.ok(Object.hasOwn(repair.update.$unset, 'classification'));
  assert.equal(repair.filter._id, job._id);
  assert.ok(repair.filter.$and.some(field => field.experienceRequired?.$eq === '2+ years'));
  assert.ok(repair.filter.$and.some(field => field.sourceDescription?.$eq === job.sourceDescription));
});

test('source-authored and already-correct requirements are not rewritten', () => {
  assert.equal(buildMainExperienceRepair({ ...job, sourceExperienceRequired: '2+ years' }), null);
  assert.equal(buildMainExperienceRepair({ ...job, experienceRequiredProvenance: 'source' }), null);
  assert.equal(buildMainExperienceRepair({ ...job, experienceRequired: '14+ years' }), null);
});

test('repair invalidates a completed cached decision even when derived fields are absent from its input hash', () => {
  const cached = { ...job, postClassification: { ...job.postClassification,
    inputHash: postScrapeInput(job).inputHash,
    result: { classification: { complete: true, resolved: { jobType: 'Full-time Experienced', experienceRequired: '2+ years',
      experienceProfile: { minimumYears: 2, maximumYears: null, isOpenEnded: true }, experienceYears: [2, 3], experienceBucket: '2-4' } } },
  } };
  const repair = buildMainExperienceRepair(cached);
  assert.equal(repair.update.$set.postClassification.status, 'pending');
  assert.equal(repair.update.$set.experienceProfile.minimumYears, 14);
  assert.ok(Object.hasOwn(repair.update.$unset, 'classification'));
});

test('repair clears a false specialty minimum while retaining alternative degree requirements', () => {
  const repair = buildMainExperienceRepair({ ...job, sourceDescription: 'Required qualifications: Bachelor degree with 8 years of experience or Master degree with 6 years of experience. At least 2 years of experience with CAD.' });
  assert.ok(repair);
  assert.match(repair.next, /8 years of experience or Master degree with 6 years/);
  assert.equal(repair.update.$set.experienceProfile.minimumYears, null);
  assert.deepEqual(repair.update.$set.experienceYears, []);
});

test('repair also respects required qualification fields when the description has only one specialty requirement', () => {
  const repair = buildMainExperienceRepair({ ...job,
    minimumQualification: 'At least 8 years of experience in engineering.',
    sourceDescription: 'At least 2 years of experience with CAD.',
  });
  assert.ok(repair);
  assert.equal(repair.next, '8+ years');
});
