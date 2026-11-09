import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteCandidates } from '../rewriting/runner.js';
import { buildRewriteInput, REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';

const candidate = () => {
  const job = { _id: 'retry', status: 'active', title: 'Engineer', sourceDescription: 'Build Python services.',
    descriptionRewrite: { status: 'pending', attempts: 0, policyVersion: REWRITE_MODEL.policyVersion } };
  job.sourceContentHash = job.descriptionRewrite.inputHash = buildRewriteInput(job).inputHash;
  return job;
};

test('deterministic validation rejection waits for a policy change rather than identical hourly retries', async () => {
  let saved;
  const stats = await rewriteCandidates([candidate()], { deadline: Date.now() + 10000,
    client: { format: 'prose', generate: async () => ({ finishReason: 'stop', value: null,
      validationFailure: { ok: false, reason: 'numeric_relationship_changed' } }) },
    update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; } });
  assert.equal(stats.failed, 1);
  assert.equal(saved.$set['descriptionRewrite.nextAttemptAt'], null);
  assert.equal(saved.$set.description, undefined);
});

test('transient request timeout retains delayed retry behavior', async () => {
  let saved;
  await rewriteCandidates([candidate()], { deadline: Date.now() + 10000,
    client: { generate: async () => { throw new DOMException('request timed out', 'TimeoutError'); } },
    update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; } });
  assert.ok(saved.$set['descriptionRewrite.nextAttemptAt'] instanceof Date);
  assert.ok(saved.$set['descriptionRewrite.nextAttemptAt'].getTime() > Date.now() + 3500000);
});

test('a failed old-policy record receives a fresh guarded attempt budget', async () => {
  const job = candidate();
  job.descriptionRewrite = { ...job.descriptionRewrite, status: 'failed', attempts: 3, policyVersion: 'job-description-prose-v17' };
  const writes = [];
  const stats = await rewriteCandidates([job], { deadline: Date.now() + 10000,
    client: { format: 'prose', generate: async input => ({ format: 'prose', finishReason: 'stop',
      value: { inputHash: input.inputHash, parts: [{ source: job.sourceDescription, text: 'Develop Python services.' }] } }) },
    update: async (filter, values) => { writes.push({ filter, values }); return { matchedCount: 1 }; } });
  assert.equal(stats.queueRepairs, 1);
  assert.equal(stats.published, 1);
  assert.equal(writes[0].values.$set.descriptionRewrite.attempts, 0);
  assert.equal(writes[0].values.$set.descriptionRewrite.policyVersion, REWRITE_MODEL.policyVersion);
  assert.equal(writes[1].values.$inc['descriptionRewrite.attempts'], 1);
});

test('a v24 copied publication gets a guarded retry without changing its employer source', async () => {
  const job = candidate();
  job.description = job.sourceDescription;
  job.descriptionRewrite = { ...job.descriptionRewrite, status: 'published', attempts: 3,
    policyVersion: 'job-description-prose-v24', quality: { modelEditedBlocks: 0, protectedSourceBlocks: 2 } };
  const writes = [];
  const stats = await rewriteCandidates([job], { deadline: Date.now() + 10000,
    client: { format: 'prose', generate: async input => ({ format: 'prose', finishReason: 'stop', generationRequests: 1,
      value: { inputHash: input.inputHash, parts: [{ source: job.sourceDescription, text: 'Develop Python services.' }] } }) },
    update: async (filter, values) => { writes.push({ filter, values }); return { matchedCount: 1 }; } });
  assert.equal(stats.queueRepairs, 1);
  assert.equal(stats.published, 1);
  assert.equal(writes[0].filter.$expr.$and.some(item => JSON.stringify(item).includes('descriptionRewrite.quality.modelEditedBlocks')), true);
  assert.equal(writes[0].values.$set.descriptionRewrite.status, 'pending');
  assert.equal(writes[0].values.$set.descriptionRewrite.attempts, 0);
  assert.equal(writes[0].values.$set.descriptionRewrite.policyVersion, REWRITE_MODEL.policyVersion);
  assert.equal(writes[1].values.$set.description, 'Develop Python services.');
  assert.equal(writes[1].values.$set['descriptionRewrite.quality'].outcome, 'model_edited');
  assert.ok(writes.every(({ values }) => !Object.hasOwn(values.$set, 'sourceDescription')));
});

test('already edited, current-policy and unclassified publications are not requeued', async () => {
  const base = candidate();
  for (const descriptionRewrite of [
    { status: 'published', policyVersion: 'job-description-prose-v24', quality: { modelEditedBlocks: 1, protectedSourceBlocks: 2 } },
    { status: 'published', policyVersion: REWRITE_MODEL.policyVersion, quality: { modelEditedBlocks: 0, protectedSourceBlocks: 2 } },
    { status: 'published', policyVersion: 'job-description-prose-v24' },
    { status: 'published', policyVersion: 'job-description-prose-v24', quality: { modelEditedBlocks: 0, protectedSourceBlocks: 0 } },
  ]) {
    const stats = await rewriteCandidates([{ ...base, descriptionRewrite }], { deadline: Date.now() + 10000,
      client: { generate: async () => { assert.fail('unaffected publication must not invoke the model'); } },
      update: async () => { assert.fail('unaffected publication must not be changed'); } });
    assert.equal(stats.attempted, 0);
  }
});

test('a concurrent change prevents a copied publication from being repaired or regenerated', async () => {
  const job = candidate();
  job.descriptionRewrite = { ...job.descriptionRewrite, status: 'published', policyVersion: 'job-description-prose-v24',
    quality: { modelEditedBlocks: 0, protectedSourceBlocks: 2 } };
  const stats = await rewriteCandidates([job], { deadline: Date.now() + 10000,
    client: { generate: async () => { assert.fail('conflicting snapshot must not generate'); } },
    update: async () => ({ matchedCount: 0 }) });
  assert.equal(stats.concurrentChanges, 1);
  assert.equal(stats.attempted, 0);
});
