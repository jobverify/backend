/** Recover flagged source content and Tudip title captions from exactly identified role pages. */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import Job from '../src/models/Job.js'
import { getAuthoritativeClassification, isTitleOnlyClassificationSource } from '../src/services/jobClassificationPolicy.js'
import { postScrapeInput, postScrapePersistencePatch, sourceGuardedClassification, sourceSnapshotFilter } from '../src/services/postScrapeClassification.js'
import { buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js'
import { getSourceDescription } from '../src/utils/jobSourceContent.js'
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js'
import { publicPostingDescription } from '../rewriting/publicPostingDescription.js'
import { visiblePostingProfile } from '../rewriting/visiblePostingDescription.js'
import { parseRepairArguments } from './repairUnspecifiedPublicJobTypes.js'

const sources = ['engineersindialimited', 'flexsintechnologies', 'tudiptechnologies', 'planetspark']
const reasons = ['multiple_recruitment_notices_without_role_description', 'conflicting_role_eligibility']

export function buildClassificationReviewSourceRepair(job, response, { now = new Date() } = {}) {
  const saved = job.classification
  const cache = job.postClassification
  const caption = job.source === 'tudiptechnologies' && isTitleOnlyClassificationSource(job)
  if (job.status !== 'active' || cache?.status === 'processing' || job.descriptionRewrite?.status === 'processing'
    || !visiblePostingProfile(job) || !(response?.status >= 200 && response.status < 300)) return null
  if (!caption) {
    if (!getAuthoritativeClassification(job) || saved.mode !== 'policy'
      || saved.complete !== true || saved.resolved.jobType !== 'Unspecified'
      || !saved.reviewReasons?.length || !saved.reviewReasons.every(reason => reasons.includes(reason))
      || cache?.status !== 'completed' || cache.mode !== 'policy' || cache.inputHash !== saved.inputHash
      || !Number.isInteger(saved.referenceYear) || saved.referenceYear < 1990 || saved.referenceYear > 9999) return null
    const identity = Object.fromEntries(['modelRevision', 'runtimeVersion', 'runtimeHash', 'policyHash', 'calibrationHash']
      .map(key => [key, saved[key]]))
    if (Object.values(identity).some(value => typeof value !== 'string' || !value)) return null
    if (postScrapeInput(job, { now: new Date(`${saved.referenceYear}-07-01T00:00:00Z`), identity }).inputHash !== saved.inputHash) return null
  }
  const posting = publicPostingDescription(job, response.html, response.url)
  if (!posting || (getSourceDescription(job) === posting.description && !job.sourceExperienceRequired)) return null
  // Capture current requirements from the bounded role content. An old whole-page
  // inferred experience value must not survive replacement of that page content.
  const incoming = { ...job, sourceDescription: posting.description, sourceExperienceRequired: null,
    experienceRequired: null, experienceRequiredProvenance: null, descriptionRewrite: null }
  const proposed = sourceGuardedClassification(incoming, { now, mode: 'policy' })
  // Caption recovery supplies genuinely missing role content even when source
  // rules need a fresh model prediction. Never reuse the title-only prediction.
  if (!caption && (proposed.sourceQualityIssues.length || proposed.resolved.jobType === 'Unspecified')) return null
  const description = buildDescriptionSourceUpdate(incoming, job, { mode: 'publish', now })
  const classification = postScrapePersistencePatch({ ...incoming, ...description }, job, { now, mode: 'policy' })
  return {
    evidence: posting.evidence, proposedJobType: proposed.resolved.jobType,
    filter: { ...sourceSnapshotFilter(job), ...(caption ? {
      'classification.inputHash': saved?.inputHash ?? { $exists: false },
      'postClassification.status': cache?.status ?? { $exists: false },
      'postClassification.inputHash': cache?.inputHash ?? { $exists: false },
    } : { 'classification.inputHash': saved.inputHash,
      'classification.reviewReasons': saved.reviewReasons, 'classification.resolved.jobType': 'Unspecified',
      'classification.authoritative': true, 'classification.mode': 'policy', 'classification.complete': true,
      'postClassification.status': 'completed', 'postClassification.mode': 'policy',
      'postClassification.inputHash': cache.inputHash }) },
    update: { $set: { ...description, ...classification.set, sourceExperienceRequired: null,
      experienceRequired: null, jobType: 'Unspecified' },
      $unset: { ...classification.unset, experienceRequiredProvenance: '' } },
  }
}

const fetchPage = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } })
  return { url: response.url, status: response.status, html: await response.text() }
}

export async function repairClassificationReviewSources({ model = Job, apply = false, source = null,
  readPage = fetchPage, now = () => new Date(), refreshSummary = refreshJobDatasetSummary } = {}) {
  const summary = { mode: apply ? 'applied' : 'preview', scanned: 0, eligible: 0, updated: 0,
    stale: 0, skipped: 0, fetchFailed: 0, changes: [] }
  const cursor = model.find({ status: 'active', source: source ? { $in: sources.filter(value => value === source) } : { $in: sources },
    $or: [{ 'classification.authoritative': true, 'classification.mode': 'policy', 'classification.complete': true,
      'classification.resolved.jobType': 'Unspecified', 'classification.reviewReasons': { $in: reasons } },
    { source: 'tudiptechnologies' }] })
    .sort({ _id: 1 }).lean().cursor({ batchSize: 100 })
  const pages = new Map()
  try {
    for await (const job of cursor) {
      summary.scanned++
      if (!visiblePostingProfile(job)) { summary.skipped++; continue }
      const url = job.sourceUrl || job.applyUrl || job.link
      let response
      try {
        if (!pages.has(url)) pages.set(url, Promise.resolve().then(() => readPage(url)))
        response = await pages.get(url)
      } catch { summary.fetchFailed++; continue }
      const operation = buildClassificationReviewSourceRepair(job, response, { now: now() })
      if (!operation) { summary.skipped++; continue }
      summary.eligible++
      summary.changes.push({ id: String(job._id), source: job.source,
        proposedJobType: operation.proposedJobType, sourceEvidence: operation.evidence,
        nextState: 'pending_rewrite_and_classification' })
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
    console.log('Preview: node scripts/repairClassificationReviewSources.js [--source=source-id]\nApply: add --apply. Covers source review flags and Tudip title-only captions. Validated source replacements are queued for rewriting and classification; old predictions are invalidated.')
  } else {
    try {
      const options = parseRepairArguments(process.argv.slice(2))
      const { default: connectDB } = await import('../db/db.js')
      await connectDB()
      console.log(JSON.stringify(await repairClassificationReviewSources(options), null, 2))
    } catch (error) {
      console.error('Classification source repair failed:', error.name)
      process.exitCode = 1
    } finally { await mongoose.disconnect() }
  }
}
