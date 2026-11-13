import { randomUUID } from 'node:crypto';
import Job from '../../src/models/Job.js';
import { sourceSnapshotFilter, classificationShard } from '../../src/services/postScrapeClassification.js';
import { batchEligibilityInput, resolveBatchEligibility } from '../../src/services/jobBatchEligibility.js';
import { BATCH_ELIGIBILITY_VERSION } from '../../src/utils/jobBatchEligibility.js';
import { BATCH_EXTRACTION_IDENTITY, startBatchExtractor, validateBatchExtraction } from '../../src/services/batchEligibilityExtraction.js';
import { assignedSavedJobs } from './assignedSavedJobs.js';

const snapshotValue = (job, field) => {
  let value = job;
  for (const key of field.split('.')) {
    if (!value || !Object.hasOwn(value, key)) return { [field]: { $exists: false } };
    value = value[key];
  }
  return { [field]: { $eq: value } };
};
export const batchEligibilitySnapshot = job => {
  const snapshot = sourceSnapshotFilter(job);
  snapshot.$and.push(...['eligibleBatchRange', 'classification.inputHash', 'classification.resolved', 'classification.classifiedAt',
    'postClassification.inputHash', 'postClassification.status', 'postClassification.result.classification.resolved',
    'batchEligibility.inputHash', 'batchEligibility.status', 'batchEligibility.mode'].map(field => snapshotValue(job, field)));
  return snapshot;
};
const fieldsFor = result => ({ eligibleBatches: result.eligibleBatches || [], eligibleBatchRange: result.eligibleBatchRange || null,
  eligibleBatchesProvenance: result.eligibleBatchesProvenance || null });

export async function refreshJobBatchEligibility({ model = Job, now = () => new Date(), mode = 'shadow', shard = 0, shardCount = 1,
  budgetSeconds = 18000, signal, referenceDate, extractorFactory = startBatchExtractor, onResult = () => {}, onProgress = () => {} } = {}) {
  if (!['shadow', 'policy'].includes(mode)) throw new Error('Invalid batch eligibility mode');
  classificationShard('validate', shardCount);
  if (!Number.isSafeInteger(shard) || shard < 0 || shard >= shardCount || !Number.isFinite(budgetSeconds) || budgetSeconds < 0) throw new Error('Invalid batch phase configuration');
  const summary = { scanned: 0, assigned: 0, explicit: 0, inferred: 0, unknown: 0, cached: 0,
    failed: 0, stale: 0, leased: 0, pending: 0, modelRequests: 0, extractionCached: 0, budgetExhausted: false };
  const started = Date.now(), deadline = started + budgetSeconds * 1000, owner = randomUUID();
  const clock = referenceDate || now(); // Anchor stays fixed; lease and completion clocks keep advancing.
  const shouldStop = () => signal?.aborted || Date.now() >= deadline;
  const phaseSignal = AbortSignal.timeout(Math.max(1, Math.floor(budgetSeconds * 1000)));
  const combinedSignal = signal ? AbortSignal.any([signal, phaseSignal]) : phaseSignal;
  let extractor, extractorError;
  try {
    for await (const job of assignedSavedJobs(model, shard, shardCount, summary, shouldStop)) {
      summary.assigned++;
      const input = batchEligibilityInput(job, { now: clock, mode });
      const prior = job.batchEligibility;
      const emit = async (status, extra = {}) => {
        await onResult({ phase: 'batch_eligibility', id: String(job._id), shard, status, inputHash: input.inputHash, ...extra });
        await onProgress({ ...summary });
      };
      if (prior?.inputHash === input.inputHash && prior.mode === mode && prior.version === BATCH_ELIGIBILITY_VERSION
        && ['explicit', 'inferred', 'unknown'].includes(prior.status)
        && (mode === 'shadow' || JSON.stringify(fieldsFor(job)) === JSON.stringify(prior.result))
        && (!prior.extraction || prior.extraction.identity === BATCH_EXTRACTION_IDENTITY)) {
        summary.cached++; summary[prior.status]++;
        await emit('cached', { eligibilityStatus: prior.status });
        continue;
      }
      const snapshot = batchEligibilitySnapshot(job);
      const metadata = { version: BATCH_ELIGIBILITY_VERSION, inputHash: input.inputHash, sourceHash: input.sourceHash,
        ...(prior?.basis ? { basis: prior.basis } : {}),
        anchorYear: input.anchorYear, mode, status: 'processing', owner,
        leaseUntil: new Date(now().getTime() + Math.max(10 * 60 * 1000, deadline - Date.now() + 120000)), attemptedAt: now() };
      const claim = await model.updateOne({ ...snapshot, $or: [
        { 'batchEligibility.status': { $ne: 'processing' } }, { 'batchEligibility.leaseUntil': { $lte: now() } },
        { 'batchEligibility.leaseUntil': { $exists: false } },
      ] }, { $set: { batchEligibility: metadata } });
      if (!claim.modifiedCount) { summary.leased++; summary.pending++; await emit('leased'); continue; }
      // The claim replaced metadata only; all employer inputs must still match.
      const guarded = batchEligibilitySnapshot({ ...job, batchEligibility: metadata });
      guarded['batchEligibility.owner'] = owner;
      let outcome, details;
      try {
        let result = resolveBatchEligibility(input), extraction;
        if (result.needsExtraction) {
          const cache = prior?.extraction;
          if (cache?.sourceHash === input.sourceHash && cache.identity === BATCH_EXTRACTION_IDENTITY) {
            extraction = validateBatchExtraction(cache.result, input.text); summary.extractionCached++;
          } else {
            if (extractorError) throw extractorError;
            if (!extractor) {
              try { extractor = await extractorFactory({ signal: combinedSignal }); summary.extractorValidation = extractor.validation || null; }
              catch (error) { extractorError = error; throw error; }
            }
            combinedSignal.throwIfAborted();
            summary.modelRequests++;
            extraction = validateBatchExtraction(await extractor.extract({ text: input.text, signal: combinedSignal }), input.text);
          }
          result = resolveBatchEligibility(input, extraction);
        }
        const completed = { ...metadata, status: result.status, basis: result.basis, evidence: result.evidence,
          result: fieldsFor(result), completedAt: now(),
          ...(extraction ? { extraction: { identity: BATCH_EXTRACTION_IDENTITY, sourceHash: input.sourceHash, result: extraction } }
            : prior?.extraction?.sourceHash === input.sourceHash ? { extraction: prior.extraction } : {}) };
        delete completed.owner; delete completed.leaseUntil;
        const saved = await model.updateOne(guarded, { $set: { batchEligibility: completed,
          ...(mode === 'policy' ? fieldsFor(result) : {}) } });
        if (saved.matchedCount) { summary[result.status]++; outcome = result.status; details = { basis: result.basis }; }
        else {
          summary.stale++; summary.pending++;
          await model.updateOne({ _id: job._id, 'batchEligibility.owner': owner }, { $set: {
            'batchEligibility.status': 'pending', 'batchEligibility.reason': 'source_changed',
          }, $unset: { 'batchEligibility.owner': '', 'batchEligibility.leaseUntil': '' } });
          outcome = 'stale';
        }
      } catch (error) {
        summary.failed++; summary.pending++;
        // A changed source cannot be cleared or overwritten by this attempt.
        const failed = { ...metadata, status: 'failed', reason: error.name === 'TimeoutError' || combinedSignal.aborted ? 'interrupted' : 'extraction_error' };
        delete failed.owner; delete failed.leaseUntil;
        const saved = await model.updateOne(guarded, { $set: { batchEligibility: failed,
          ...(mode === 'policy' && (job.eligibleBatchesProvenance !== 'source' || prior?.basis === 'source_text') ? {
            eligibleBatches: [], eligibleBatchRange: null, eligibleBatchesProvenance: null,
          } : {}) } });
        if (!saved.matchedCount) {
          summary.stale++;
          await model.updateOne({ _id: job._id, 'batchEligibility.owner': owner }, { $set: { 'batchEligibility.status': 'pending',
            'batchEligibility.reason': 'source_changed' }, $unset: { 'batchEligibility.owner': '', 'batchEligibility.leaseUntil': '' } });
        }
        outcome = 'failed'; details = { reason: failed.reason, errorType: error.name, message: String(error.message).slice(0, 300) };
      }
      await emit(outcome, details);
    }
  } finally { await extractor?.stop?.(); }
  if (shouldStop()) { summary.budgetExhausted = true; summary.pending = Math.max(1, summary.pending); }
  return { ...summary, elapsedSeconds: (Date.now() - started) / 1000 };
}
