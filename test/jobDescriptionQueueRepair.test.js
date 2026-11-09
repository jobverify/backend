import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { reconcileRewriteCandidate } from '../rewriting/queue.js';
import { rewriteCandidates } from '../rewriting/runner.js';
import { buildSourceFacts } from '../rewriting/factPlan.js';

const source = 'Role overview: Build Python services for customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.';
const candidate = (extra = {}) => {
  const job = { title: 'Software Engineer', company: 'Example', location: 'Bengaluru', status: 'active',
    sourceDescription: source, description: source, sourceContentHashVersion: 2,
    descriptionRewrite: { status: 'pending', inputHash: 'outdated-queue-hash', attempts: 1 }, ...extra };
  job.sourceContentHash = buildRewriteInput(job).inputHash;
  return job;
};

test('rewrite queue reconciliation repairs metadata without changing employer content', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false });
  const insert = async data => { const row = candidate(data); const { insertedId } = await Job.collection.insertOne(row); return { ...row, _id: insertedId }; };
  const update = (filter, values) => Job.updateOne(filter, values, { runValidators: true });

  await t.test('verified source permits queue repair and repair is idempotent', async () => {
    const row = await insert({});
    const result = await reconcileRewriteCandidate(row, { update });
    assert.equal(result.kind, 'ready'); assert.equal(result.repaired, true);
    const saved = await Job.findById(row._id).lean();
    assert.equal(saved.descriptionRewrite.inputHash, row.sourceContentHash);
    assert.equal(saved.descriptionRewrite.status, 'pending'); assert.equal(saved.descriptionRewrite.attempts, 0);
    assert.equal(saved.description, row.description); assert.equal(saved.sourceDescription, row.sourceDescription);
    assert.equal(saved.sourceContentHash, row.sourceContentHash);
    const again = await reconcileRewriteCandidate(saved, { update: () => assert.fail('No second write needed') });
    assert.equal(again.kind, 'ready'); assert.equal(again.repaired, false);
  });

  await t.test('ineligible source is skipped without generation or description changes', async () => {
    const row = await insert({ sourceDescription: '<p> </p>', description: '<p> </p>' });
    const result = await reconcileRewriteCandidate(row, { update });
    const saved = await Job.findById(row._id).lean();
    assert.equal(result.kind, 'skipped'); assert.equal(result.reason, 'insufficient_source');
    assert.equal(saved.descriptionRewrite.status, 'skipped');
    assert.equal(saved.descriptionRewrite.inputHash, row.sourceContentHash);
    assert.equal(saved.description, row.description); assert.equal(saved.sourceDescription, row.sourceDescription);
  });

  await t.test('unverified sources and completed entries cannot be repaired', async () => {
    for (const extra of [{ sourceContentHash: 'unverified-source' }, { descriptionRewrite: { status: 'published', inputHash: 'old' } }, { descriptionRewrite: { status: 'skipped', inputHash: 'old' } }]) {
      const row = { ...candidate(), ...extra };
      const result = await reconcileRewriteCandidate(row, { update: () => assert.fail('Must not modify this record') });
      assert.equal(result.kind, 'stale');
    }
  });

  await t.test('concurrent source or queue changes defeat the repair update', async () => {
    for (const change of [{ location: 'Pune' }, { sourceDescription: 'Concurrent employer source' },
      { preferredQualification: null }, { 'descriptionRewrite.inputHash': 'concurrent-queue-version' }]) {
      const row = await insert({});
      const result = await reconcileRewriteCandidate(row, { update: async (filter, values) => {
        await Job.updateOne({ _id: row._id }, { $set: change });
        return update(filter, values);
      } });
      assert.equal(result.kind, 'conflict');
      const saved = await Job.findById(row._id).lean();
      assert.equal(saved.descriptionRewrite.attempts, 1);
      assert.equal(saved.descriptionRewrite.inputHash, change['descriptionRewrite.inputHash'] || 'outdated-queue-hash');
    }
  });

  await t.test('publication checks the repaired snapshot again after inference', async () => {
    for (const change of [{ location: 'Pune' }, { 'descriptionRewrite.inputHash': 'concurrent-queue-version' }]) {
      const row = await insert({});
      const stats = await rewriteCandidates([row], { update, deadline: Date.now() + 10000,
        client: { generate: async input => {
          await Job.updateOne({ _id: row._id }, { $set: change });
          return { value: { categories: buildSourceFacts(input).map(fact => fact.section ?? 9), overview: null }, finishReason: 'stop' };
        } },
      });
      assert.equal(stats.queueRepairs, 1); assert.equal(stats.published, 0); assert.equal(stats.concurrentChanges, 1);
      const saved = await Job.findById(row._id).lean();
      assert.equal(saved.description, row.description); assert.equal(saved.descriptionRewrite.status, 'pending');
    }
  });

  await t.test('an explicit blank employer source never falls back to the display description', async () => {
    const row = await insert({ sourceDescription: null });
    const result = await reconcileRewriteCandidate(row, { update });
    assert.equal(result.kind, 'skipped');
    const saved = await Job.findById(row._id).lean();
    assert.equal(saved.sourceDescription, null); assert.equal(saved.description, source);
  });

  await t.test('legacy raw whitespace survives exact comparisons through Mongoose', async () => {
    const row = await insert({ location: ' Bengaluru ', company: ' Example ' });
    const result = await reconcileRewriteCandidate(row, { update });
    assert.equal(result.kind, 'ready'); assert.equal(result.repaired, true);
    const saved = await Job.findById(row._id).lean();
    assert.equal(saved.location, row.location); assert.equal(saved.company, row.company);
  });

  await t.test('parallel runner repairs eligible entries and skips ineligible entries', async () => {
    const good = await insert({});
    const short = await insert({ sourceDescription: '<p> </p>', description: '<p> </p>' });
    let requests = 0;
    const stats = await rewriteCandidates([good, short], { concurrency: 4, update, deadline: Date.now() + 10000,
      client: { generate: async input => { requests++; return { value: { categories: buildSourceFacts(input).map(fact => fact.section ?? 9), overview: null }, finishReason: 'stop' }; } },
    });
    assert.equal(requests, 1); assert.equal(stats.published, 1); assert.equal(stats.skipped, 1);
    assert.equal(stats.queueRepairs, 2); assert.equal(stats.staleSources, 0); assert.equal(stats.concurrentChanges, 0);
    assert.equal((await Job.findById(good._id).lean()).descriptionRewrite.status, 'published');
    assert.equal((await Job.findById(short._id).lean()).descriptionRewrite.status, 'skipped');
  });
});
