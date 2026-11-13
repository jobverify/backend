import { buildRewriteInput, REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';

const sourceCopyPolicy = 'job-description-prose-v24';
// This migration targets the policy that froze factual prose, not every
// publication from an older policy. Accepted model edits stay published.
export const sourceCopyRetryQuery = () => ({
  'descriptionRewrite.status': 'published',
  'descriptionRewrite.policyVersion': { $eq: sourceCopyPolicy, $ne: REWRITE_MODEL.policyVersion },
  'descriptionRewrite.quality.modelEditedBlocks': 0,
  'descriptionRewrite.quality.protectedSourceBlocks': { $gt: 0 },
});
const isSourceCopyRetry = job => job.descriptionRewrite?.status === 'published'
  && job.descriptionRewrite.policyVersion === sourceCopyPolicy && sourceCopyPolicy !== REWRITE_MODEL.policyVersion
  && job.descriptionRewrite.quality?.modelEditedBlocks === 0 && job.descriptionRewrite.quality?.protectedSourceBlocks > 0;

const snapshotFields = [
  'title', 'originalTitle', 'company', 'sourceDescription', 'jobDescription', 'description',
  'minimumQualification', 'preferredQualification', 'sourceEmploymentType',
  'sourceExperienceRequired', 'location', 'salary', 'sourceContentHashVersion',
  'descriptionRewrite.status', 'descriptionRewrite.inputHash', 'descriptionRewrite.attempts',
  'descriptionRewrite.queuedAt', 'descriptionRewrite.nextAttemptAt',
  'descriptionRewrite.policyVersion',
  'descriptionRewrite.quality.modelEditedBlocks', 'descriptionRewrite.quality.protectedSourceBlocks',
];

// Also guard the actual inputs: a concurrent writer may change a field before its hash.
export const rewriteSnapshotFilter = job => ({
  _id: job._id, status: 'active', sourceContentHash: job.sourceContentHash,
  // Literal-first expressions avoid Mongoose string setters trimming snapshot values.
  $expr: { $and: snapshotFields.map(field => {
    const value = field.split('.').reduce((object, key) => object?.[key], job);
    return value === undefined || value === null
      ? { $eq: [{ $type: '$' + field }, value === undefined ? 'missing' : 'null'] }
      : { $eq: [{ $literal: value }, '$' + field] };
  }) },
});

/** Repair queue metadata only when the stored source independently verifies it. */
export const reconcileRewriteCandidate = async (job, { update, now = new Date() } = {}) => {
  const input = buildRewriteInput(job);
  const sourceCopyRetry = isSourceCopyRetry(job);
  if (job.status !== 'active' || (!['pending', 'failed'].includes(job.descriptionRewrite?.status) && !sourceCopyRetry)
    || input.inputHash !== job.sourceContentHash) return { kind: 'stale' };
  const changedPolicy = job.descriptionRewrite.status === 'failed'
    && typeof job.descriptionRewrite.policyVersion === 'string'
    && job.descriptionRewrite.policyVersion !== REWRITE_MODEL.policyVersion;
  const eligible = input.eligible && input.sourceQuality?.ok !== false;
  if (eligible && job.descriptionRewrite.inputHash === input.inputHash && !changedPolicy && !sourceCopyRetry) {
    return { kind: 'ready', job, input, repaired: false };
  }

  const reason = eligible ? undefined : input.sourceQuality?.reason || 'insufficient_source';
  const descriptionRewrite = { status: eligible ? 'pending' : 'skipped',
    inputHash: input.inputHash, queuedAt: now, attempts: 0, policyVersion: REWRITE_MODEL.policyVersion,
    ...(reason ? { reason, attemptedAt: now } : {}),
  };
  const saved = await update(rewriteSnapshotFilter(job), { $set: { descriptionRewrite } });
  if (saved.matchedCount === 0) return { kind: 'conflict' };
  return { kind: eligible ? 'ready' : 'skipped', repaired: true, reason,
    job: { ...job, descriptionRewrite }, input };
};
