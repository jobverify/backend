/** Preview or repair reviewed classifications using unchanged source and cached inference. */
import path from 'node:path'
import { readFileSync } from 'node:fs'
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
const quarantineReasons = new Set(['sparse_role_description', 'truncated_role_description', 'missing_role_description',
  'closed_vacancy', 'non_vacancy_programme', 'non_vacancy_test_posting',
  'model_contract_from_third_party_duties', 'model_intern_without_placement_evidence'])
const quarantineReview = row => row?.verdict === 'source_quality' && row.independentJobType === 'Unspecified'
  && Array.isArray(row.expectedSourceQualityIssues) && row.expectedSourceQualityIssues.length > 0
  && new Set(row.expectedSourceQualityIssues).size === row.expectedSourceQualityIssues.length
  && row.expectedSourceQualityIssues.every(reason => quarantineReasons.has(reason))

export function buildClassificationReviewRepair(job, { now = new Date(), manualReview = null } = {}) {
  const saved = job.classification
  const cache = job.postClassification
  const cached = cache?.result?.classification
  // A full independent review may identify an error that was never flagged.
  // Bind that judgment to this exact saved input and public category. The
  // corrected policy must independently reproduce the requested replacement.
  const reviewed = manualReview?.id === String(job._id) && manualReview.readFullOriginal === true
    && (manualReview.verdict === 'misclassified' || quarantineReview(manualReview)) && manualReview.classificationInputHash === saved?.inputHash
    && manualReview.finalJobType === job.jobType && (PUBLIC_JOB_TYPES.includes(manualReview.independentJobType) || quarantineReview(manualReview))
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
  const quarantined = reviewed && quarantineReview(manualReview) && refreshed.resolved.jobType === 'Unspecified'
    && refreshed.status === 'uncertain'
    && JSON.stringify([...refreshed.sourceQualityIssues].sort()) === JSON.stringify([...manualReview.expectedSourceQualityIssues].sort())
  const reviewedBounds = manualReview?.independentEmployerExperience
  const boundsMatch = reviewed && reviewedBounds && ['minimumYears', 'maximumYears'].every(key =>
    typeof reviewedBounds[key] === 'number' && Number.isFinite(reviewedBounds[key])
      && reviewedBounds[key] >= 0 && reviewedBounds[key] <= 40
      && refreshed.resolved.employerExperienceProfile?.[key] === reviewedBounds[key])
    && reviewedBounds.minimumYears <= reviewedBounds.maximumYears
  if (reviewedBounds && !boundsMatch) return null
  const remainingReviews = refreshed.reviewReasons.filter(reason => !(boundsMatch
    && refreshed.resolved.jobType === 'Full-time Experienced' && reason === 'entry_level_title_with_required_experience'))
  if (!quarantined && (!PUBLIC_JOB_TYPES.includes(refreshed.resolved.jobType) || remainingReviews.length
    || refreshed.sourceQualityIssues.length || refreshed.status === 'uncertain')) return null
  if (quarantineReview(manualReview) && !quarantined) return null
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

export function validateClassificationReviewManifest(manualReviews) {
  if (!Array.isArray(manualReviews) || !manualReviews.length) throw new Error('Review manifest must contain reviewed records')
  const ids = new Set()
  for (const row of manualReviews) {
    if (!/^[a-f\d]{24}$/i.test(row?.id || '') || ids.has(row.id.toLowerCase())
      || !/^[a-f\d]{64}$/i.test(row.classificationInputHash || '')
      || row.readFullOriginal !== true || (row.verdict !== 'misclassified' && !quarantineReview(row))
      || (!PUBLIC_JOB_TYPES.includes(row.independentJobType) && !quarantineReview(row))
      || ![...PUBLIC_JOB_TYPES, 'Unspecified'].includes(row.finalJobType)) throw new Error('Invalid or duplicate reviewed record')
    ids.add(row.id.toLowerCase())
  }
  return new Map(manualReviews.map(row => [row.id, row]))
}

export async function repairClassificationReviews({ model = Job, apply = false, source = null, manualReviews = null,
  now = () => new Date(), refreshSummary = refreshJobDatasetSummary } = {}) {
  const reviews = manualReviews === null ? null : validateClassificationReviewManifest(manualReviews)
  const filter = { status: 'active', 'classification.authoritative': true,
    'classification.mode': 'policy', 'classification.complete': true,
    ...(reviews ? { _id: { $in: [...reviews.keys()] } } : { 'classification.reviewReasons': { $in: reviewReasons } }),
    ...(source ? { source } : {}) }
  const summary = { mode: apply ? 'applied' : 'preview', scanned: 0, eligible: 0,
    updated: 0, stale: 0, skipped: 0, changes: [] }
  const cursor = model.find(filter).sort({ _id: 1 }).lean().cursor({ batchSize: 100 })
  try {
    for await (const job of cursor) {
      summary.scanned++
      if (reviews && !reviews.has(String(job._id))) { summary.skipped++; continue }
      const operation = buildClassificationReviewRepair(job, { now: now(), manualReview: reviews?.get(String(job._id)) ?? null })
      if (!operation) { summary.skipped++; continue }
      summary.eligible++
      summary.changes.push({ id: String(job._id), source: job.source,
        from: job.classification.resolved.jobType, to: operation.update.$set.classification.resolved.jobType,
        previousExperience: job.classification.resolved.experienceProfile,
        correctedExperience: operation.update.$set.experienceProfile })
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
    console.log('Preview: node scripts/repairClassificationReviews.js [--source=source-id] [--review-file=manifest.json]\nApply: add --apply. Uses cached inference; uncertain changes require a matching source-quality review.')
  } else {
    try {
      const args = process.argv.slice(2)
      const reviewFiles = args.filter(arg => arg.startsWith('--review-file='))
      if (reviewFiles.length > 1 || reviewFiles.some(arg => !arg.slice('--review-file='.length).trim())) throw new Error('Specify one nonempty review file')
      const options = parseRepairArguments(args.filter(arg => !arg.startsWith('--review-file=')))
      if (reviewFiles.length) {
        options.manualReviews = JSON.parse(readFileSync(reviewFiles[0].slice('--review-file='.length), 'utf8')).reviews
        validateClassificationReviewManifest(options.manualReviews)
      }
      const { default: connectDB } = await import('../db/db.js')
      await connectDB()
      console.log(JSON.stringify(await repairClassificationReviews(options), null, 2))
    } catch (error) {
      console.error('Classification review repair failed:', error.name)
      process.exitCode = 1
    } finally { await mongoose.disconnect() }
  }
}
