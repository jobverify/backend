/** Preview or repair reviewed classifications using unchanged source and cached inference. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import Job from '../src/models/Job.js'
import { CLASSIFICATION_FIELDS, getAuthoritativeClassification } from '../src/services/jobClassificationPolicy.js'
import { GLICLASS_IDENTITY, postScrapeInput, resolvePostScrapeClassification, sourceSnapshotFilter } from '../src/services/postScrapeClassification.js'
import { normalizePublicJobType, PUBLIC_JOB_TYPES } from '../src/utils/publicJobTypeLabel.js'
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js'
import { trialNativeInputHash } from './trialNativePredictionCache.js'
import { parseRepairArguments } from './repairUnspecifiedPublicJobTypes.js'

export { parseRepairArguments }

const reviewReasons = ['entry_level_title_with_experienced_prediction',
  'conflicting_role_eligibility', 'multiple_recruitment_notices_without_role_description']

export function buildClassificationReviewRepair(job, { now = new Date(), manualReview = null } = {}) {
  const saved = job.classification
  const cache = job.postClassification
  const cached = cache?.result?.classification
  // A full independent review may identify an error that was never flagged.
  // Bind that judgment to this exact saved input and public category. The
  // corrected policy must independently reproduce the requested replacement.
  const reviewed = manualReview?.id === String(job._id) && manualReview.readFullOriginal === true
    && manualReview.verdict === 'misclassified' && manualReview.classificationInputHash === saved?.inputHash
    && manualReview.finalJobType === job.jobType && PUBLIC_JOB_TYPES.includes(manualReview.independentJobType)
  if (manualReview !== null && !reviewed) return null
  if (!getAuthoritativeClassification(job) || saved.mode !== 'policy' || saved.complete !== true
    || (!reviewed && !saved.reviewReasons?.some(reason => reviewReasons.includes(reason)))
    || cache?.mode !== 'policy' || cache.status !== 'completed'
    || !saved.inputHash || cache.inputHash !== saved.inputHash || cached?.inputHash !== saved.inputHash
    || cached.resolved?.jobType !== saved.resolved.jobType || cached.mode !== 'policy' || cached.complete !== true
    || saved.modelRevision !== GLICLASS_IDENTITY.modelRevision
    || !Number.isInteger(saved.referenceYear) || saved.referenceYear < 1990 || saved.referenceYear > 9999) return null
  const identity = Object.fromEntries(['modelRevision', 'runtimeVersion', 'runtimeHash', 'policyHash', 'calibrationHash']
    .map(key => [key, saved[key]]))
  if (Object.values(identity).some(value => typeof value !== 'string' || !value)) return null
  const referenceDate = new Date(`${saved.referenceYear}-07-01T00:00:00Z`)
  if (postScrapeInput(job, { now: referenceDate, identity }).inputHash !== saved.inputHash) return null
  const input = postScrapeInput(job, { now })
  // A policy edit may reuse inference; changed source, weights or inference code may not.
  if (cache.result.nativeInputHash !== trialNativeInputHash(input)) return null
  let refreshed
  try { refreshed = resolvePostScrapeClassification(job, cache.result.prediction, { now, mode: 'policy' }) }
  catch { return null }
  if (!PUBLIC_JOB_TYPES.includes(refreshed.resolved.jobType) || refreshed.reviewReasons.length
    || refreshed.sourceQualityIssues.length || refreshed.status === 'uncertain') return null
  if (reviewed && refreshed.resolved.jobType !== manualReview.independentJobType) return null
  return {
    filter: { ...sourceSnapshotFilter(job), jobType: job.jobType,
      'classification.inputHash': saved.inputHash, 'classification.policyVersion': saved.policyVersion,
      'classification.authoritative': true, 'classification.mode': 'policy', 'classification.complete': true,
      'classification.classifiedAt': saved.classifiedAt, 'classification.reviewReasons': saved.reviewReasons,
      'classification.resolved.jobType': saved.resolved.jobType,
      'postClassification.mode': 'policy', 'postClassification.status': 'completed',
      'postClassification.inputHash': saved.inputHash,
      'postClassification.result.classification.inputHash': saved.inputHash,
      'postClassification.result.classification.resolved.jobType': cached.resolved.jobType,
      'postClassification.result.nativeInputHash': cache.result.nativeInputHash,
      'postClassification.result.prediction': cache.result.prediction },
    update: { $set: { classification: refreshed,
      ...Object.fromEntries(CLASSIFICATION_FIELDS.map(field => [field, refreshed.resolved[field] ?? null])),
      jobType: normalizePublicJobType(refreshed.resolved.jobType),
      'postClassification.inputHash': refreshed.inputHash,
      'postClassification.result.classification': refreshed,
    } },
  }
}

export async function repairClassificationReviews({ model = Job, apply = false, source = null,
  now = () => new Date(), refreshSummary = refreshJobDatasetSummary } = {}) {
  const filter = { status: 'active', 'classification.authoritative': true,
    'classification.mode': 'policy', 'classification.complete': true,
    'classification.reviewReasons': { $in: reviewReasons }, ...(source ? { source } : {}) }
  const summary = { mode: apply ? 'applied' : 'preview', scanned: 0, eligible: 0,
    updated: 0, stale: 0, skipped: 0, changes: [] }
  const cursor = model.find(filter).sort({ _id: 1 }).lean().cursor({ batchSize: 100 })
  try {
    for await (const job of cursor) {
      summary.scanned++
      const operation = buildClassificationReviewRepair(job, { now: now() })
      if (!operation) { summary.skipped++; continue }
      summary.eligible++
      summary.changes.push({ id: String(job._id), source: job.source,
        from: job.classification.resolved.jobType, to: operation.update.$set.classification.resolved.jobType })
      if (!apply) continue
      const result = await model.updateOne(operation.filter, operation.update)
      if (result.modifiedCount === 1) summary.updated++
      else summary.stale++
    }
  } finally {
    await cursor.close()
    if (apply && summary.updated) await refreshSummary()
  }
  return summary
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    console.log('Preview: node scripts/repairClassificationReviews.js [--source=source-id]\nApply: add --apply. Uses cached inference; unresolved source issues are skipped.')
  } else {
    try {
      const options = parseRepairArguments(process.argv.slice(2))
      const { default: connectDB } = await import('../db/db.js')
      await connectDB()
      console.log(JSON.stringify(await repairClassificationReviews(options), null, 2))
    } catch (error) {
      console.error('Classification review repair failed:', error.name)
      process.exitCode = 1
    } finally { await mongoose.disconnect() }
  }
}
