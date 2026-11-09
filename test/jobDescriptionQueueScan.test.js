import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Job from '../src/models/Job.js';
import { rewriteQueueQuery, rewriteQueueScan, rewriteQueuePages, rewriteFailureDetails } from '../rewriting/runner.js';

test('large rewrite queues stream through the existing index without a blocking sort', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) },
    instance: { args: ['--setParameter', 'internalQueryMaxBlockingSortMemoryUsageBytes=1048576',
      '--setParameter', 'allowDiskUseByDefault=false'] },
  });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false });
  const now = new Date();
  const jobs = Array.from({ length: 80 }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(), title: 'Engineer', company: 'Example', status: 'active',
    sourceContentHash: `hash-${i}`, sourceDescription: 'Employer description. '.repeat(3000),
    descriptionRewrite: { status: i % 2 ? 'pending' : 'failed', attempts: 0,
      nextAttemptAt: new Date(0), queuedAt: new Date(now.getTime() - i * 1000) },
  }));
  const excluded = ['published', 'skipped', 'baseline'].map(status => ({
    ...jobs[0], _id: new mongoose.Types.ObjectId(), descriptionRewrite: { status, attempts: 0 },
  }));
  excluded.push({ ...jobs[0], _id: new mongoose.Types.ObjectId(), descriptionRewrite: { status: 'failed', attempts: 3, nextAttemptAt: new Date(0) } });
  excluded.push({ ...jobs[0], _id: new mongoose.Types.ObjectId(), descriptionRewrite: { status: 'failed', attempts: 0, nextAttemptAt: new Date(now.getTime() + 3600000) } });
  excluded.push({ ...jobs[0], _id: new mongoose.Types.ObjectId(), status: 'expired' });
  await Job.collection.insertMany([...jobs, ...excluded]);

  // Reproduce the production failure before exercising the replacement scan.
  const oldCursor = Job.find(rewriteQueueQuery()).sort({ 'descriptionRewrite.queuedAt': 1, _id: 1 })
    .allowDiskUse(false).lean().cursor({ batchSize: 1 });
  try {
    await assert.rejects(oldCursor.next(), error => error.code === 292);
  } finally { await oldCursor.close(); }

  const plan = await rewriteQueueScan(Job).explain('queryPlanner');
  const stages = [];
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    if (value.stage) stages.push(value.stage);
    for (const child of Object.values(value)) if (typeof child === 'object') inspect(child);
  };
  inspect(plan.queryPlanner.winningPlan);
  assert.ok(stages.includes('IXSCAN'));
  assert.ok(!stages.includes('SORT'));

  const ids = [];
  for await (const job of rewriteQueuePages(Job, rewriteQueueQuery(), { pageSize: 8 })) ids.push(String(job._id));
  assert.deepEqual(ids, jobs.map(job => String(job._id)).sort());
  assert.equal(await Job.countDocuments(), jobs.length + excluded.length);

  const partitions = await Promise.all([0, 1, 2, 3].map(async shard => {
    const query = rewriteQueueQuery(now, { shard, shardCount: 4 });
    assert.equal(await Job.countDocuments(query), 20);
    const partitionPlan = await rewriteQueueScan(Job, query).explain('queryPlanner');
    assert.doesNotMatch(JSON.stringify(partitionPlan.queryPlanner.winningPlan), /"stage":"SORT"/);
    const assigned = [];
    for await (const job of rewriteQueuePages(Job, query, { pageSize: 3 })) {
      assigned.push(String(job._id));
      // Source changes must not change the assignment while other runners scan.
      await Job.updateOne({ _id: job._id }, { $set: { sourceContentHash: `changed-${shard}` } });
    }
    assert.equal(await Job.countDocuments(query), 20);
    return assigned;
  }));
  assert.deepEqual(partitions.flat().sort(), ids);
  assert.equal(new Set(partitions.flat()).size, partitions.flat().length);
  const dynamicPartitions = await Promise.all(Array.from({ length: 32 }, async (_, shard) => {
    const query = rewriteQueueQuery(now, { shard, shardCount: 32 });
    const assigned = [];
    for await (const job of rewriteQueuePages(Job, query, { pageSize: 3 })) assigned.push(String(job._id));
    assert.equal(await Job.countDocuments(query), assigned.length);
    return assigned;
  }));
  assert.deepEqual(dynamicPartitions.flat().sort(), ids);
  assert.equal(new Set(dynamicPartitions.flat()).size, ids.length);
});

test('rewrite diagnostics identify MongoDB failures without exposing source text or credentials', () => {
  const error = Object.assign(new Error('mongodb+srv://user:password@example/jobs secret employer description'), {
    name: 'MongoServerError', code: 292, codeName: 'QueryExceededMemoryLimitNoDiskUseAllowed',
  });
  const details = rewriteFailureDetails(error, 'process_queue');
  assert.deepEqual(details, { errorType: 'MongoServerError', errorPhase: 'process_queue',
    errorCode: 292, errorCodeName: 'QueryExceededMemoryLimitNoDiskUseAllowed' });
  assert.doesNotMatch(JSON.stringify(details), /password|mongodb|employer|example/);
  assert.deepEqual(rewriteFailureDetails(Object.assign(new Error('private'), {
    code: 'private', codeName: 'private source text',
  }), 'connect'), { errorType: 'Error', errorPhase: 'connect' });
});
