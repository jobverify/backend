import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteQueueQuery, rewriteDeadline } from '../rewriting/runner.js';
import { REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';

test('queue includes pending work, due retries and the affected v24 source copies', () => {
  const now = new Date('2026-10-02T10:00:00Z');
  const query = rewriteQueueQuery(now);
  assert.equal(query.status, 'active');
  assert.deepEqual(query.$or, [
    { 'descriptionRewrite.status': 'pending', 'descriptionRewrite.attempts': { $lt: 3 } },
    { 'descriptionRewrite.status': 'failed', 'descriptionRewrite.attempts': { $lt: 3 }, 'descriptionRewrite.nextAttemptAt': { $type: 'date', $lte: now } },
    { 'descriptionRewrite.status': 'failed', 'descriptionRewrite.policyVersion': { $type: 'string', $ne: REWRITE_MODEL.policyVersion } },
    { 'descriptionRewrite.status': 'published',
      'descriptionRewrite.policyVersion': { $eq: 'job-description-prose-v24', $ne: REWRITE_MODEL.policyVersion },
      'descriptionRewrite.quality.modelEditedBlocks': 0,
      'descriptionRewrite.quality.protectedSourceBlocks': { $gt: 0 } },
  ]);
});

test('malformed workflow timestamps and limits fail closed', () => {
  assert.throws(() => rewriteDeadline({ workflowStartedAt: 'bad' }), /timestamp/);
  assert.throws(() => rewriteDeadline({ workflowSeconds: 'bad' }), /deadline/);
});

test('queue partition identities are validated before any work can be assigned', () => {
  for (const options of [{ shard: -1, shardCount: 4 }, { shard: 4, shardCount: 4 },
    { shard: .5, shardCount: 4 }, { shard: 0, shardCount: 0 }, { shard: 0, shardCount: 17 },
    { shard: 0, shardCount: 2.5 }, { shard: NaN, shardCount: 4 }]) {
    assert.throws(() => rewriteQueueQuery(new Date(), options), /shard/i);
  }
});
