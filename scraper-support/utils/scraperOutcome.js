import { isCompleteScraperAttempt } from './inventoryEvidence.js'

export const isUnavailableZeroOutcome = outcome => (
  ['coverage-gap', 'blocked-zero', 'unverified-zero'].includes(outcome)
)

// Upserts may proceed for partial results; retiring unseen vacancies needs a
// current complete source inventory and complete role details before the save.
export const inventoryCleanupOptions = diagnostics => (
  diagnostics?.inventoryEvidence?.lifecycleCleanupAllowed !== false
    && diagnostics?.staleCheckSkipped !== true && isCompleteScraperAttempt({ success: true, ...diagnostics })
    ? {} : { replaceExisting: false }
)

// Older checkpoints may have marked unavailable zero inventories successful.
export const scraperTaskOutcome = (result = {}) => {
  if (result.skipped === true) return 'skipped'
  if (isUnavailableZeroOutcome(result.zeroJobEvidence)) return 'softFailed'
  if (result.success === true) return 'succeeded'
  return result.softFailure === true ? 'softFailed' : 'hardFailed'
}

// Normalize quality without inventing processing completion for historical rows.
export const normalizeScraperTaskResult = (result = {}) => {
  const normalized = { ...result, success: scraperTaskOutcome(result) === 'succeeded' }
  return isUnavailableZeroOutcome(result.zeroJobEvidence)
    ? { ...normalized, softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap', partial: true,
      error: result.error || `Job inventory unavailable (${result.zeroJobEvidence}): ${
        typeof result.inventoryEvidence?.reason === 'string' && result.inventoryEvidence.reason.trim()
          ? result.inventoryEvidence.reason.trim().slice(0, 2048)
          : 'A complete current job inventory could not be verified.'}` }
    : normalized
}

// History rows use jobsFound; runner results use jobs. Skipped attempts belong
// to neither success nor failure totals, and partial successes retain job yield.
export const summarizeScraperHistory = (results = []) => {
  const totals = { totalJobs: 0, sourcesSucceeded: 0, sourcesFailed: 0 }
  for (const result of results) {
    const outcome = scraperTaskOutcome(result)
    if (outcome === 'succeeded') {
      totals.sourcesSucceeded++
      totals.totalJobs += Number(result.jobsFound ?? result.jobs ?? 0)
    } else if (outcome !== 'skipped') totals.sourcesFailed++
  }
  return totals
}

// Processing can finish while the source inventory remains unavailable or partial.
// Keep persisted job counters intact and let checkpoints retain this terminal attempt.
export const finishScraperProcessing = (result = {}) => {
  const finished = normalizeScraperTaskResult({ ...result, processingComplete: true })
  return isCompleteScraperAttempt(finished) ? finished : { ...finished, partial: true }
}
