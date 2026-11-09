import { buildSourceFacts } from '../rewriting/factPlan.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClassificationInput } from '../src/services/jobClassificationPolicy.js';
import { extractJobFilterSignals } from '../src/utils/jobFilterSignals.js';
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js';

const raw = 'Responsibilities: Build and maintain reliable Python services for customer applications. Requirements: At least 2 years of software development experience. Preferred qualifications: AWS experience is nice to have.';

test('classification uses preserved employer source rather than generated display text', () => {
  const result = buildClassificationInput({ title: 'Software Engineer', sourceDescription: raw, description: 'Requires 10 years of experience. Kubernetes is mandatory.' });
  assert.match(result.body, /2 years/);
  assert.doesNotMatch(result.body, /10 years|Kubernetes/);
});

test('skill and experience extraction cannot learn invented requirements from display text', () => {
  const result = extractJobFilterSignals({ title: 'Software Engineer', sourceDescription: raw, description: 'Requirements: 10 years of experience with Kubernetes.' });
  assert.equal(result.experienceProfile.minimumYears, 2);
  assert.ok(result.jobSkills.some(skill => skill.canonicalName === 'Python'));
  assert.ok(!result.jobSkills.some(skill => /Kubernetes/i.test(skill.canonicalName)));
});

test('normalization uses source experience and work arrangement while retaining source provenance', () => {
  const result = normalizeScrapedJob({ title: 'Software Engineer', company: 'Example', sourceDescription: raw, description: 'A remote internship with no experience required.' });
  assert.equal(result.experienceProfile.minimumYears, 2);
  assert.notEqual(result.workArrangement, 'Remote');
  assert.notEqual(result.employmentType, 'Internship');
});

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import Job from '../src/models/Job.js';
import { rewriteCandidates } from '../rewriting/runner.js';
import { saveToDB, generateFingerprint } from '../scraper-support/utils/saveToDB.js';

test('scraper persistence queues only new or changed sources and preserves published rewrites', { timeout: 300000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  await mongoose.connect(mongo.getUri());
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  const incoming = { title: 'Software Engineer', company: 'Example', city: 'Bangalore', location: 'Bangalore, India', country: 'India', applyUrl: 'https://example.com/jobs/rewrite', sourceUrl: 'https://example.com/jobs/rewrite', jobDescription: raw };
  const options = { descriptionRewriteMode: 'publish', enrichPublicExperience: false, replaceExisting: false, refreshDatasetSummary: false, enqueueAlerts: false };
  await saveToDB([incoming], 'example', options);
  let stored = await Job.findOne({ company: 'Example' }).lean();
  assert.equal(stored.sourceDescription, raw);
  assert.equal(stored.descriptionRewrite.status, 'pending');
  assert.match(stored.sourceContentHash, /^[a-f0-9]{64}$/);
  const firstHash = stored.sourceContentHash;
  const generated = '## Role overview\n\nBuild Python services with the required software experience.';
  await Job.updateOne({ _id: stored._id }, { $set: { description: generated, 'descriptionRewrite.status': 'published', descriptionFormat: 'markdown' } });
  await saveToDB([incoming], 'example', options);
  stored = await Job.findById(stored._id).lean();
  assert.equal(stored.description, generated);
  assert.equal(stored.sourceContentHash, firstHash);
  assert.equal(stored.descriptionRewrite.status, 'published');

  await saveToDB([{ ...incoming, jobDescription: raw.replace('2 years', '3 years') }], 'example', options);
  stored = await Job.findById(stored._id).lean();
  assert.match(stored.description, /3 years/);
  assert.notEqual(stored.sourceContentHash, firstHash);
  assert.equal(stored.descriptionRewrite.status, 'pending');
  assert.equal(stored.descriptionFormat, 'plain');

  await Job.updateOne({ _id: stored._id }, { $set: { description: generated, 'descriptionRewrite.status': 'published', descriptionFormat: 'markdown' } });
  await saveToDB([{ ...incoming, jobDescription: null, preserveExistingSourceContent: true }], 'example', options);
  stored = await Job.findById(stored._id).lean();
  assert.equal(stored.description, generated);
  assert.match(stored.sourceDescription, /3 years/);

  const legacy = { ...incoming, title: 'Legacy Engineer', applyUrl: 'https://example.com/jobs/legacy', sourceUrl: 'https://example.com/jobs/legacy', description: raw };
  await Job.create({ ...normalizeScrapedJob(legacy), location: stored.location, description: raw, fingerprint: generateFingerprint(normalizeScrapedJob(legacy)), source: 'example' });
  await Job.updateOne({ title: 'Legacy Engineer' }, { $set: { experienceRequired: 'At least 2 years of experience', employmentType: 'Full-time' } });
  await saveToDB([{ ...legacy, sourceExperienceRequired: 'At least 2 years of experience', sourceEmploymentType: 'Full-time' }], 'example', options);
  const retained = await Job.findOne({ title: 'Legacy Engineer' }).lean();
  assert.equal(retained.description, raw);
  assert.equal(retained.sourceDescription, raw);
  assert.equal(retained.descriptionRewrite.status, 'baseline');

  await Job.updateOne({_id:stored._id},{$set:{'descriptionRewrite.status':'pending','descriptionRewrite.attempts':0}});
  const qualityCandidate=await Job.findById(stored._id).lean();
  const qualityStats=await rewriteCandidates([qualityCandidate],{deadline:Date.now()+10000,client:{generate:async input=>({value:{categories:buildSourceFacts(input).map(f=>f.section??9),overview:null},finishReason:'stop'})},update:(filter,values)=>Job.updateOne(filter,values,{runValidators:true})});
  assert.equal(qualityStats.published,1);
  const qualityStored=await Job.findById(stored._id).lean();
  assert.equal(qualityStored.descriptionRewrite.quality.method,'llm_source_fact_organization');
  assert.equal(qualityStored.descriptionRewrite.quality.factCoverage,1);
  assert.match(qualityStored.description,/3 years/);
  assert.equal(qualityStored.sourceContentHash,qualityCandidate.sourceContentHash);
  // Exercise the real Mongo optimistic guard while generation is in flight.
  await Job.updateOne({ _id: stored._id }, { $set: { 'descriptionRewrite.status': 'pending', 'descriptionRewrite.attempts': 0 } });
  const candidate = await Job.findById(stored._id).lean();
  const stats = await rewriteCandidates([candidate], { deadline: Date.now() + 10000,
    client: { generate: async () => {
      await Job.updateOne({ _id: candidate._id }, { $set: { sourceContentHash: 'concurrent-source-version', description: 'Newest employer source', 'descriptionRewrite.status': 'pending' } });
      return { value: { sections: [] }, finishReason: 'stop' };
    } }, update: (filter, values) => Job.updateOne(filter, values),
  });
  assert.equal(stats.concurrentChanges, 1);
  const concurrent = await Job.findById(candidate._id).lean();
  assert.equal(concurrent.description, 'Newest employer source');
  assert.equal(concurrent.descriptionRewrite.status, 'pending');
});


test('Mongoose documents expose preserved source through schema getters', () => {
  const document = new Job({ title: 'Software Engineer', company: 'Example', sourceDescription: raw, description: 'Requires 10 years of Kubernetes experience.' });
  assert.match(buildClassificationInput(document).body, /2 years/);
  assert.doesNotMatch(buildClassificationInput(document).body, /10 years|Kubernetes/);
});


test('source normalization retains Mongoose title and employment fields', () => {
  const document = new Job({ title: 'Software Engineer', company: 'Example', employmentType: 'Contract', sourceDescription: raw, description: 'A remote internship.' });
  const normalized = normalizeScrapedJob(document);
  assert.equal(normalized.originalTitle, 'Software Engineer');
  assert.equal(normalized.employmentType, 'Contract');
});
