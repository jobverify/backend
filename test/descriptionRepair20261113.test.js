import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { buildDescriptionRepairPlan, applyDescriptionRepairPlan, descriptionRepairHash, verifiedNativeDescription } from '../rewriting/descriptionRepair.js';

const now = new Date('2026-11-13T12:00:00Z');
const fixture = () => ({ _id: new ObjectId(), status: 'active', title: 'Engineer', company: 'Employer',
  description: 'Responsibilities: • Build services. • Review tests. Required qualifications: At least 2 years of experience.',
  descriptionFormat: 'markdown', sourceDescription: '<p>Immutable employer source.</p>',
  sourceContentHash: 'original-hash', descriptionRewrite: { status: 'published', inputHash: 'original-hash', policyVersion: 'prior' }, updatedAt: new Date('2026-11-12T12:00:00Z') });

test('description repairs back up exact records and refuse concurrent source, status, or display changes', async () => {
  const server = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  const client = await MongoClient.connect(server.getUri());
  try {
    const collection = client.db().collection('jobs');
    const original = fixture();
    await collection.insertOne(original);
    const plan = JSON.parse(JSON.stringify(buildDescriptionRepairPlan([original], { now })));
    assert.equal(plan.rows.length, 1);
    const backups = [];
    const result = await applyDescriptionRepairPlan(collection, plan, { now, backup: async value => {
      assert.equal((await collection.findOne({ _id: original._id })).description, original.description);
      backups.push(value);
    } });
    assert.equal(result.applied, 1);
    assert.equal(backups.length, 1);
    const after = await collection.findOne({ _id: original._id });
    assert.match(after.description, /\n• Build services/);
    assert.equal(after.sourceDescription, original.sourceDescription);
    assert.equal(after.sourceContentHash, original.sourceContentHash);
    assert.deepEqual(after.descriptionRewrite, original.descriptionRewrite);
    assert.ok(after.updatedAt instanceof Date);
    for (const change of [{ description: 'New description' }, { sourceDescription: 'New source' }, { status: 'archived' }, { title: 'New title' }]) {
      await collection.replaceOne({ _id: original._id }, { ...original, ...change });
      const refused = await applyDescriptionRepairPlan(collection, plan, { now, backup: () => assert.fail('stale record must not be backed up or written') });
      assert.equal(refused.conflicts, 1);
    }
    await collection.replaceOne({ _id: original._id }, original);
    await assert.rejects(applyDescriptionRepairPlan(collection, plan, { now, backup: () => { throw new Error('Backup unavailable'); } }), /Backup unavailable/);
    assert.equal((await collection.findOne({ _id: original._id })).description, original.description);
  } finally { await client.close(); await server.stop(); }
});

test('the complete plan is validated before the first database read or write', async () => {
  const plan = buildDescriptionRepairPlan([fixture(), fixture()], { now });
  plan.rows[1].set.salary = 'Unsupported';
  plan.hash = descriptionRepairHash(plan);
  await assert.rejects(applyDescriptionRepairPlan({ findOne: () => assert.fail('invalid plan must not reach Mongo') }, plan, { now, backup() {} }), /unsupported/);
  const changed = buildDescriptionRepairPlan([fixture()], { now });
  changed.rows[0].set.description = 'Tampered';
  await assert.rejects(applyDescriptionRepairPlan({}, changed, { now, backup() {} }), /Invalid/);
  await assert.rejects(applyDescriptionRepairPlan({}, buildDescriptionRepairPlan([fixture()], { now }), { now: new Date(+now + 86400001), backup() {} }), /expired/);
});

test('native recovery binds employer identity and quarantine preserves the original evidence', () => {
  const job = { ...fixture(), source: 'ascendion', jobId: '123', originalTitle: 'Engineer | Ascendion',
    sourceDescription: '{"onboardingConfig":{"disablePrePopulation":false},"viewMode":{"fieldLabel":"Duration"},"editMode":{"required":false}}' };
  const evidence = { status: 200, url: 'https://jobs.ascendion.com/api/pcsx/position_details?position_id=123&domain=ascendion.com&hl=en',
    body: { data: { id: 123, name: 'Engineer', jobDescription: '<h2>Responsibilities</h2><p>Build services and maintain tests for customers.</p>' } } };
  const recovered = buildDescriptionRepairPlan([job], { now, nativeEvidence: { [String(job._id)]: evidence } });
  assert.equal(recovered.rows[0].kind, 'native_source');
  assert.equal(recovered.rows[0].set.sourceDescription, evidence.body.data.jobDescription);
  assert.equal(recovered.rows[0].set.descriptionRewrite.status, 'pending');
  assert.throws(() => verifiedNativeDescription(job, { ...evidence, body: { data: { ...evidence.body.data, id: 124 } } }), /identity/);
  assert.throws(() => verifiedNativeDescription(job, { ...evidence, url: 'https://example.test/123' }), /identity/);
  const quarantine = buildDescriptionRepairPlan([job], { now });
  assert.equal(quarantine.rows[0].kind, 'quarantine');
  assert.equal(quarantine.rows[0].set.description, null);
  assert.equal(quarantine.rows[0].set.sourceDescription, undefined);
});

test('SuccessFactors recovery cannot use the saved listing as employer-observed identity', () => {
  const job = { ...fixture(), title: 'SAP Expert', source: 'volkswagengrouptechnologysolutionsindia', jobId: '10496', sourceUrl: 'https://career10.successfactors.com/career?career_job_req_id=10496' };
  const evidence = { status: 200, url: job.sourceUrl,
    body: '<title>Career Opportunities: SAP Expert (20000)</title><div class="jobdescription"><p>Different role body.</p></div>' };
  assert.throws(() => verifiedNativeDescription(job, evidence), /identity/);
  const exact = { ...evidence, body: '<title>Career Opportunities: SAP Expert (10496)</title><div>Requisition ID 10496</div><div class="jobdescription"><p>Maintain SAP systems.</p></div>' };
  assert.match(verifiedNativeDescription(job, exact), /Maintain SAP systems/);
  assert.equal(verifiedNativeDescription(job, { ...evidence, body: '<main>Position unavailable.</main>' }), null);
});

test('operational layout repair leaves missing descriptions and an existing quarantine untouched', () => {
  const missing = { ...fixture(), description: null, sourceDescription: null, descriptionFormat: 'plain', descriptionRewrite: undefined };
  assert.equal(buildDescriptionRepairPlan([missing], { now }).rows.length, 0);
  const contaminated = { ...fixture(), sourceDescription: '{"onboardingConfig":{"disablePrePopulation":false}}' };
  const plan = buildDescriptionRepairPlan([contaminated], { now });
  assert.equal(plan.rows[0].kind, 'quarantine');
  assert.equal(buildDescriptionRepairPlan([{ ...contaminated, ...plan.rows[0].set }], { now }).rows.length, 0);
});
