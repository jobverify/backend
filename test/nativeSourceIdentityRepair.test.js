import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { generateFingerprint } from '../scraper-support/utils/applicationIdentity.js';
import { buildDescriptionRepairPlan, validateDescriptionRepairPlan } from '../scripts/repairMissingSourceDescriptions.js';

function evidence(source, jobId, sourceUrl, dateTag) {
  const now = new Date();
  const before = { _id: new mongoose.Types.ObjectId(), source, jobId, requisitionId: jobId,
    title: 'Senior Engineer', originalTitle: 'Senior Engineer', company: 'Verified employer', department: null,
    sourceUrl, applyUrl: sourceUrl, sourceDescription: null, description: null, status: 'active',
    isPublicIndia: true, city: 'Bangalore', country: 'India', location: 'Bangalore, India', locations: ['Bangalore, India'],
    postedAt: new Date(+now - 86400000), postedAtProvenance: 'observation',
    postedAtProvenanceValue: new Date(+now - 86400000).toISOString(), updatedAt: new Date(+now - 3600000) };
  before.fingerprint = generateFingerprint(before);
  const candidate = { ...before, sourceDescription: 'Employer responsibilities, qualifications and required experience.',
    sourceDetailComplete: true, postingDate: new Date(+now - 2 * 86400000).toISOString(), sourceDateEvidence: dateTag };
  return { jobs: [before], now, trials: [{ source, productionWrites: false,
    finishedAt: new Date(+now - 1000).toISOString(), jobs: [candidate] }] };
}

test('Coupa repair requires the same native role URL and verified publication date', () => {
  const input = evidence('coupasoftwareinc', '11944',
    'https://careers.coupa.com/en/jobs/f987be5a-6950-4a07-9ab1-db1afc1b5d25/senior-engineer-11944/',
    'coupa-canonical-jobposting-dates-v1');
  assert.equal(buildDescriptionRepairPlan(input).entries.length, 1);
  input.trials[0].jobs[0].sourceUrl = input.jobs[0].sourceUrl.replace('11944/', '11936/');
  assert.equal(buildDescriptionRepairPlan(input).entries.length, 0);
});

test('Sobha repair preserves employer posting dates and stores a day deadline through its full day', () => {
  const input = evidence('sobha', 'MPR-GMW-000185',
    'https://sobhalimited-careers.peoplestrong.com/job/detail/MPR-GMW-000185',
    'sobha-peoplestrong-native-detail-listing-v1');
  const candidate = input.trials[0].jobs[0], before = input.jobs[0];
  before.postedAt = new Date(candidate.postingDate);
  before.postedAtProvenance = 'source'; before.postedAtProvenanceValue = candidate.postingDate;
  Object.assign(candidate, { sourceNativeRealm: 1368, nativeRequisitionStatus: 'OPEN',
    closingDate: input.now.toISOString().slice(0, 10), sourceClosingDateIsExact: false, sourceDatePrecision: 'day' });
  const [entry] = buildDescriptionRepairPlan(input).entries;
  assert.ok(entry);
  assert.equal(Object.hasOwn(entry.update.$set, 'postedAt'), false);
  const exclusiveEnd = new Date(candidate.closingDate); exclusiveEnd.setUTCHours(24, 0, 0, 0);
  assert.equal(+entry.update.$set.closingDate, +exclusiveEnd);
  assert.equal(entry.expectedVisible, true);
});

test('Verteil repair accepts its advertised native application URL and keeps an old source date private', async () => {
  const input = evidence('verteiltechnologies', '43', 'https://www.verteil.com/career', 'verteil-native-job-posting-v1');
  input.jobs[0].applyUrl = 'https://recruitcareers.zappyhire.com/en/Verteil/apply?job=43';
  input.jobs[0].fingerprint = generateFingerprint(input.jobs[0]);
  Object.assign(input.trials[0].jobs[0], { sourceUrl: input.jobs[0].applyUrl, applyUrl: input.jobs[0].applyUrl,
    sourceDetailUrl: 'https://verteil.zappyhire-multitenant-be-prod.zappyhire.com/api/careers/jobs/43/', postingDate: '2023-12-22' });
  const plan = buildDescriptionRepairPlan(input);
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].expectedVisible, false);
  assert.equal(Object.hasOwn(plan.entries[0].update.$set, 'fingerprint'), false);
  assert.equal((await validateDescriptionRepairPlan(plan)).visibleAfter, 0);
});

test('Aurigo corrects the locale route and matching fingerprint without changing the stored record or employer date', async () => {
  const input = evidence('aurigo', '2313', 'https://careers.aurigo.com/job/Senior-Engineer/2313/', 'aurigo-native-posting-dates-v1');
  const candidate = input.trials[0].jobs[0], before = input.jobs[0];
  before.postedAt = new Date(candidate.postingDate); before.postedAtProvenance = 'source';
  before.postedAtProvenanceValue = candidate.postingDate;
  Object.assign(candidate, { sourceCanonicalUrl: 'https://careers.aurigo.com/job/Senior-Engineer/2313-en_US/',
    sourceDetailEvidence: 'aurigo-native-canonical-role-microdata-v1' });
  const plan = buildDescriptionRepairPlan(input), [entry] = plan.entries;
  assert.ok(entry);
  assert.equal(entry.update.$set.applyUrl, candidate.sourceCanonicalUrl);
  assert.equal(entry.update.$set.sourceUrl, candidate.sourceCanonicalUrl);
  assert.equal(entry.update.$set.fingerprint, generateFingerprint({ ...before, ...entry.update.$set }));
  assert.equal(Object.hasOwn(entry.update.$set, 'postedAt'), false);
  assert.equal(Object.hasOwn(entry.update.$set, '_id'), false);
  const validation = await validateDescriptionRepairPlan(plan);
  assert.equal(validation.visibleAfter, 1);
  assert.equal(validation.applicationIdentitiesCorrected, 1);
  candidate.sourceCanonicalUrl = candidate.sourceCanonicalUrl.replace('2313-', '2314-');
  assert.equal(buildDescriptionRepairPlan(input).entries.length, 0);
});

function hexaviewEvidence() {
  const input = evidence('hexaviewtechnologies', 'undefined-bangalore', 'https://www.hexaviewtech.com/undefined');
  const before = input.jobs[0];
  Object.assign(before, { requisitionId: 'undefined', locations: ['Bangalore'], location: 'Bangalore' });
  before.fingerprint = generateFingerprint(before);
  Object.assign(input.trials[0].jobs[0], { source: 'hexaviewtechnologies', jobId: 'senior-net-developer-bangalore',
    requisitionId: 'senior-net-developer', locations: ['Bangalore'], postingDate: null,
    sourceUrl: 'https://www.hexaviewtech.com/job-openings/senior-net-developer',
    applyUrl: 'https://www.hexaviewtech.com/job-openings/senior-net-developer',
    sourceIdentityEvidence: 'hexaview-native-card-canonical-cms-binding-v1',
    sourceLegacyIdentity: { savedId: String(before._id), jobId: before.jobId, fingerprint: before.fingerprint,
      requisitionId: before.requisitionId, sourceUrl: before.sourceUrl, applyUrl: before.applyUrl, locations: before.locations } });
  return input;
}

test('Hexaview rekeys a uniquely proved legacy vacancy while preserving its record ID and observation date', async () => {
  const input = hexaviewEvidence(), [candidate] = input.trials[0].jobs;
  const plan = buildDescriptionRepairPlan(input), [entry] = plan.entries;
  assert.ok(entry);
  assert.equal(entry.update.$set.jobId, candidate.jobId);
  assert.equal(entry.update.$set.requisitionId, candidate.requisitionId);
  assert.equal(entry.update.$set.fingerprint, generateFingerprint({ ...input.jobs[0], ...entry.update.$set }));
  assert.equal(Object.hasOwn(entry.update.$set, 'postedAt'), false);
  assert.equal((await validateDescriptionRepairPlan(plan)).visibleAfter, 1);
  candidate.sourceLegacyIdentity.fingerprint = 'unrelated';
  assert.equal(buildDescriptionRepairPlan(input).entries.length, 0);
});

test('identity repair refuses a target fingerprint or native ID already belonging to another record', () => {
  for (const conflict of ['fingerprint', 'jobId']) {
    const input = hexaviewEvidence();
    const candidate = input.trials[0].jobs[0];
    const other = { ...input.jobs[0], _id: new mongoose.Types.ObjectId(), jobId: 'unrelated', fingerprint: 'unrelated' };
    other[conflict] = conflict === 'fingerprint' ? generateFingerprint({ ...input.jobs[0], ...candidate }) : candidate.jobId;
    input.jobs.push(other);
    assert.throws(() => buildDescriptionRepairPlan(input), /collision/i);
  }
});

test('Aurigo native city correction updates location indexes and the application fingerprint together', () => {
  const input = evidence('aurigo', '2313', 'https://careers.aurigo.com/job/Senior-Engineer/2313/', 'aurigo-native-posting-dates-v1');
  Object.assign(input.jobs[0], { city: 'Remote', location: 'India', locations: ['India'], cityKey: 'remote', publicCityKey: 'remote', locationKeys: ['india', 'remote'] });
  input.jobs[0].fingerprint = generateFingerprint(input.jobs[0]);
  Object.assign(input.trials[0].jobs[0], { sourceCanonicalUrl: 'https://careers.aurigo.com/job/Senior-Engineer/2313-en_US/',
    sourceDetailEvidence: 'aurigo-native-canonical-role-microdata-v1',
    city: 'Bangalore', location: 'Bangalore, India', locations: ['Bangalore, India'],
    sourceLocationEvidence: 'aurigo-native-visible-posting-location-v1' });
  const [entry] = buildDescriptionRepairPlan(input).entries;
  assert.equal(entry.update.$set.city, 'Bangalore');
  assert.equal(entry.update.$set.publicCityKey, 'bangalore');
  assert.equal(entry.update.$set.cityKey, 'bangalore');
  assert.deepEqual(entry.update.$set.locations, ['Bangalore, India']);
  assert.equal(entry.update.$set.locationKeys.includes('remote'), false);
  assert.equal(entry.update.$set.fingerprint, generateFingerprint({ ...input.jobs[0], ...entry.update.$set }));
});
