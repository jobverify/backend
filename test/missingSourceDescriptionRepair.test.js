import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { buildDescriptionRepairPlan, descriptionRepairHash, validateDescriptionRepairPlan } from '../scripts/repairMissingSourceDescriptions.js';

const evidence = () => {
  const now = new Date();
  const job = { _id: new mongoose.Types.ObjectId(), source: 'viewzenlabs', jobId: 'frontend-angular',
    company: 'ViewZen Labs', title: 'Frontend - Angular', originalTitle: 'Frontend - Angular',
    department: 'Software Developer', sourceUrl: 'https://www.viewzenlabs.com/careers',
    sourceDescription: null, description: null, status: 'active', isPublicIndia: true,
    city: 'Chennai', country: 'India', location: 'Chennai, India',
    postedAt: new Date(now.getTime() - 86400000), updatedAt: new Date(now.getTime() - 3600000),
    postClassification: { mode: 'policy', status: 'completed' }, classification: { stale: true } };
  const candidate = { ...job, sourceDescription: 'Software Developer (0-1 years)\nBE / B.Tech or equivalent.\nAngular 16+ Components/Services',
    sourceDetailComplete: false, sourceDetailFailureKind: 'full-description-not-published' };
  return { jobs: [job], trials: [{ source: job.source, productionWrites: false,
    finishedAt: new Date(now.getTime() - 1000).toISOString(), jobs: [candidate] }], now };
};

test('description repair preserves lifecycle dates and invalidates stale classification', () => {
  const input = evidence(), plan = buildDescriptionRepairPlan(input), [entry] = plan.entries;
  assert.equal(plan.entries.length, 1);
  assert.equal(entry.update.$set.description, input.trials[0].jobs[0].sourceDescription);
  assert.equal(entry.update.$set.postClassification.status, 'pending');
  assert.equal(entry.update.$set.postClassification.mode, 'policy');
  assert.deepEqual(entry.update.$unset, { classification: '' });
  for (const field of ['postedAt', 'scrapedAt', 'status', 'fingerprint', 'applyUrl', 'jobId']) {
    assert.equal(Object.hasOwn(entry.update.$set, field), false);
  }
  const saved = mongoose.mongo.BSON.EJSON.parse(mongoose.mongo.BSON.EJSON.stringify(plan, { relaxed: false }));
  assert.equal(descriptionRepairHash(saved), descriptionRepairHash(plan));
});

test('repair rejects stale, duplicate and unsupported trial evidence', () => {
  const input = evidence();
  assert.throws(() => buildDescriptionRepairPlan({ ...input, now: new Date(+input.now + 49 * 3600000) }), /Fresh/);
  assert.throws(() => buildDescriptionRepairPlan({ ...input, trials: [...input.trials, ...input.trials] }), /distinct/);
  input.trials[0].source = 'other';
  assert.throws(() => buildDescriptionRepairPlan(input), /Unsupported/);
});

test('repair leaves published content, disabled sources and conflicting employer identities alone', () => {
  for (const change of [input => { input.jobs[0].sourceDescription = 'Existing employer source'; },
    input => { input.statuses = [{ source: 'viewzenlabs', isActive: false }]; },
    input => { input.trials[0].jobs[0].title = 'Different role'; },
    input => { input.trials[0].jobs[0].sourceUrl = 'https://another-employer.example/careers'; }]) {
    const input = evidence(); change(input);
    assert.equal(buildDescriptionRepairPlan(input).entries.length, 0);
  }
});

test('temporary Mongo verifies actual visibility, idempotency and concurrent edit protection', async () => {
  const validation = await validateDescriptionRepairPlan(buildDescriptionRepairPlan(evidence()));
  assert.equal(validation.passed, true);
  assert.equal(validation.visibleAfter, 1);
  assert.equal(validation.concurrentChangesProtected, true);
});

const unstopEvidence = () => {
  const now = new Date();
  const jobs = ['Business Operations Specialist', 'Enterprise Sales'].map((title, index) => ({
    _id: new mongoose.Types.ObjectId(), source: 'unstop', jobId: null, company: 'Unstop', title, originalTitle: title,
    department: null, sourceUrl: index === 0 ? 'https://unstop.com/jobs/business-operations-specialist-unstop-1780828'
      : 'https://unstop.com/jobs/enterprise-sales-unstop-1735410', sourceDescription: null, description: null,
    status: 'active', isPublicIndia: true, jobType: 'Full-time Experienced', country: 'India', location: 'India',
    postedAt: new Date(+now - 86400000), postedAtProvenance: 'observation',
    postedAtProvenanceValue: new Date(+now - 86400000).toISOString(), updatedAt: new Date(+now - 3600000),
  }));
  const candidates = jobs.map((job, index) => ({ source: 'unstop', company: 'Unstop', title: job.title,
    sourceUrl: job.sourceUrl, link: job.sourceUrl, location: 'India', country: 'India', sourceDetailComplete: true,
    sourceDescription: 'Employer-published responsibilities and requirements for ' + job.title,
    sourceDateEvidence: 'unstop-canonical-amp-jobposting-and-visible-deadline-v1',
    postingDate: new Date(+now - (index === 0 ? 2 : 65) * 86400000).toISOString(),
    closingDate: new Date(+now + 86400000).toISOString(), sourceClosingDateIsExact: true,
  }));
  return { jobs, now, trials: [{ source: 'unstop', productionWrites: false,
    finishedAt: new Date(+now - 1000).toISOString(), jobs: candidates }] };
};

test('Unstop repair distinguishes null native IDs by canonical URL and corrects only observation dates', () => {
  const input = unstopEvidence();
  let plan;
  assert.doesNotThrow(() => { plan = buildDescriptionRepairPlan(input); });
  assert.equal(plan.entries.length, 2);
  assert.deepEqual(plan.entries.map(entry => entry.expectedVisible), [true, false]);
  assert.equal(plan.entries[1].update.$set.postedAt.toISOString(), input.trials[0].jobs[1].postingDate);
  assert.equal(plan.entries[1].update.$set.postedAtProvenance, 'source');
  assert.equal(plan.entries[1].update.$set.closingDate.toISOString(), input.trials[0].jobs[1].closingDate);
  for (const entry of plan.entries) assert.equal(Object.hasOwn(entry.update.$set, 'jobId'), false);
  input.jobs[0].postedAtProvenance = 'source';
  const protectedPlan = buildDescriptionRepairPlan(input);
  assert.equal(protectedPlan.entries.length, 1);
  assert.equal(protectedPlan.skipped[0].reason, 'existing_source_date_conflict');
});

test('temporary Mongo validates fresh and correctly private Unstop repairs together', async () => {
  const validation = await validateDescriptionRepairPlan(buildDescriptionRepairPlan(unstopEvidence()));
  assert.equal(validation.jobsRepaired, 2);
  assert.equal(validation.visibleAfter, 1);
  assert.equal(validation.correctlyPrivateAfter, 1);
  assert.equal(validation.observationDatesCorrected, 2);
});

test('repair accepts exact Darwinbox role links and rejects an altered tenant or query', () => {
  for (const source of ['scripbox', 'seclore']) {
    const input = evidence(), jobId = 'a6acca619533fd';
    const url = 'https://' + source + '.darwinbox.in/ms/candidatev2/main/careers/jobDetails/' + jobId
      + (source === 'scripbox' ? '?from=all' : '');
    Object.assign(input.jobs[0], { source, company: source, jobId, sourceUrl: url, title: 'Client Manager', originalTitle: 'Client Manager', department: null });
    Object.assign(input.jobs[0], { postedAtProvenance: 'observation', postedAtProvenanceValue: input.jobs[0].postedAt.toISOString() });
    Object.assign(input.trials[0], { source });
    input.trials[0].jobs = [{ ...input.jobs[0], sourceDescription: '<p>Build client relationships &amp; support account renewals.</p>',
      sourceDetailComplete: true, postingDate: new Date(+input.now - 2 * 86400000).toISOString(),
      sourceDateEvidence: 'darwinbox-native-posted-on-v1' }];
    let plan;
    assert.doesNotThrow(() => { plan = buildDescriptionRepairPlan(input); });
    assert.equal(plan.entries.length, 1);
    assert.equal(plan.entries[0].update.$set.description, 'Build client relationships & support account renewals.');
    input.trials[0].jobs[0].sourceUrl = url.replace(source + '.darwinbox.in', 'another.darwinbox.in');
    assert.equal(buildDescriptionRepairPlan(input).entries.length, 0);
  }
});

test('SEOAK repair requires the exact linked native careers asset and preserves source dates', () => {
  const input = evidence();
  Object.assign(input.jobs[0], { source: 'seoak', company: 'SEOAK Innovations Private Limited', jobId: 'seoak-sales-manager',
    title: 'Sales Manager', originalTitle: 'Sales Manager', department: 'Business & Sales', sourceUrl: 'https://www.seoak.in/careers' });
  input.trials[0].source = 'seoak';
  input.trials[0].jobs = [{ ...input.jobs[0], sourceDescription: 'Sales Manager responsibilities and qualifications from the employer.',
    sourceDetailComplete: true, sourceDetailUrl: 'https://www.seoak.in/_next/static/chunks/app/careers/page-9ab6b10b31518811.js' }];
  let plan;
  assert.doesNotThrow(() => { plan = buildDescriptionRepairPlan(input); });
  assert.equal(plan.entries.length, 1);
  assert.equal(Object.hasOwn(plan.entries[0].update.$set, 'postedAt'), false);
  input.trials[0].jobs[0].sourceDetailUrl = 'https://foreign.example/_next/static/chunks/app/careers/page-9ab6b10b31518811.js';
  assert.equal(buildDescriptionRepairPlan(input).entries.length, 0);
});

test('Cognus repair retains verified content while correcting observation dates and malformed location scope', async () => {
  const input = evidence(), before = input.jobs[0], id = '61921000006710038';
  Object.assign(before, { source: 'cognustechnology', company: 'Cognus Technology', jobId: 'cognustechnology-' + id,
    requisitionId: id, title: 'Operations Executive', originalTitle: 'Operations Executive', department: null,
    sourceUrl: 'https://cognustechnology.zohorecruit.in/jobs/Careers', country: 'India', city: 'Udaipur',
    state: null, location: 'Udaipur, Gradding', postedAtProvenance: 'observation', postedAtProvenanceValue: before.postedAt.toISOString() });
  const postingDate = new Date(+input.now - 2 * 86400000).toISOString().slice(0, 10);
  input.trials[0].source = 'cognustechnology';
  input.trials[0].jobs = [{ ...before, sourceUrl: 'https://cognustechnology.zohorecruit.in/jobs/Careers/' + id + '/Operations-Executive?source=CareerSite',
    sourceDescription: 'Employer-published operations responsibilities and qualifications.', postingDate,
    sourceDetailContentComplete: true, sourceDetailComplete: false, sourceDetailFailureKind: 'malformed-native-country',
    sourceDateEvidence: 'cognus-verified-native-inline-job-v1', country: 'Gradding', state: 'Rajasthan',
    location: 'Udaipur, Rajasthan, Gradding', nativeLocationEvidence: { City: 'Udaipur', State: 'Rajasthan', Country: 'Gradding', Zip_Code: '313001' } }];
  let plan;
  assert.doesNotThrow(() => { plan = buildDescriptionRepairPlan(input); });
  assert.equal(plan.entries.length, 1);
  const entry = plan.entries[0];
  assert.equal(entry.expectedVisible, false);
  assert.equal(entry.update.$set.country, 'Gradding');
  assert.equal(entry.update.$set.isPublicIndia, false);
  assert.equal(entry.update.$set.postedAt.toISOString().slice(0, 10), postingDate);
  assert.equal(entry.update.$set.state, 'Rajasthan');
  const validation = await validateDescriptionRepairPlan(plan);
  assert.equal(validation.jobsRepaired, 1);
  assert.equal(validation.visibleAfter, 0);
  assert.equal(validation.correctlyPrivateAfter, 1);
});

test('Darwinbox repair uses native posting dates rather than publishing old campaigns from observation fallbacks', async () => {
  const input = unstopEvidence();
  input.trials[0].source = 'scripbox';
  for (const [index, before] of input.jobs.entries()) {
    const id = index === 0 ? 'a6acca619533fd' : 'a6ac61b05e605c';
    const url = 'https://scripbox.darwinbox.in/ms/candidatev2/main/careers/jobDetails/' + id + '?from=all';
    Object.assign(before, { source: 'scripbox', jobId: id, company: 'Scripbox', sourceUrl: url });
    Object.assign(input.trials[0].jobs[index], { source: 'scripbox', jobId: id, company: 'Scripbox', sourceUrl: url, link: url,
      sourceDateEvidence: 'darwinbox-native-posted-on-v1' });
  }
  const plan = buildDescriptionRepairPlan(input);
  assert.deepEqual(plan.entries.map(entry => entry.expectedVisible), [true, false]);
  assert.equal(plan.entries[1].update.$set.postedAt.toISOString(), input.trials[0].jobs[1].postingDate);
  const validation = await validateDescriptionRepairPlan(plan);
  assert.equal(validation.visibleAfter, 1);
  assert.equal(validation.correctlyPrivateAfter, 1);
  delete input.trials[0].jobs[0].sourceDateEvidence;
  assert.equal(buildDescriptionRepairPlan(input).entries.length, 1);
});

test('future native publication facts remain stored and private', async () => {
  const input = unstopEvidence();
  input.trials[0].jobs[0].postingDate = new Date(+input.now + 2 * 86400000).toISOString();
  const plan = buildDescriptionRepairPlan(input);
  assert.deepEqual(plan.entries.map(entry => entry.expectedVisible), [false, false]);
  const validation = await validateDescriptionRepairPlan(plan);
  assert.equal(validation.visibleAfter, 0);
  assert.equal(validation.jobsRepaired, 2);
});
