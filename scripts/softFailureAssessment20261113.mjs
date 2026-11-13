import { buildScraperAttemptDiagnostics, resolveZeroJobOutcome } from '../scraper-support/runner.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { finishScraperProcessing, inventoryCleanupOptions } from '../scraper-support/utils/scraperOutcome.js'

// The same persistence-free boundary used after acquisition by the real runner.
export function assessSoftFailureAcquisition(provider, jobs) {
  if (!Array.isArray(jobs) || jobs.some(job => !job || typeof job !== 'object' || Array.isArray(job))) {
    throw new TypeError('Expected an array of native job records')
  }
  const analysis = analyzePublishableJobs(jobs)
  const diagnostics = buildScraperAttemptDiagnostics(jobs, analysis, provider)
  const zeroJobEvidence = resolveZeroJobOutcome({ provider }, jobs, analysis.indiaJobs)
  const runnerOutcome = finishScraperProcessing({ success: true, ...diagnostics,
    jobs: analysis.indiaJobs.length, eligibleJobs: analysis.eligibleJobs.length,
    ...(zeroJobEvidence ? { zeroJobEvidence } : {}) })
  return { rawJobs: jobs.length, indiaJobs: analysis.indiaJobs.length, eligibleJobs: analysis.eligibleJobs.length,
    filterCounts: analysis.filterCounts, zeroJobEvidence, inventoryEvidence: readInventoryEvidence(jobs),
    cleanupOptions: inventoryCleanupOptions(diagnostics), runnerOutcome }
}
