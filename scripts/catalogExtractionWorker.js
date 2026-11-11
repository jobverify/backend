import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { extractionFailureDetails, extractionFailureReason } from './catalogExtractionFailureEvidence.js'
import { extractionDetailHealth } from '../scraper-support/utils/extractionDetailHealth.js'
import { retainNativeFailureArtifact } from './catalogExtractionFailureArtifacts.js'
import { createPublicAtsAuditCapture } from './catalogExtractionPublicAtsCapture.js'
import { extractionRawJobMetrics } from '../scraper-support/utils/extractionRawJobMetrics.js'
import { initializeScraperProxyEnvironment } from '../scraper-support/utils/proxyEnvironment.js'
export { extractionRawJobMetrics } from '../scraper-support/utils/extractionRawJobMetrics.js'

const restrictedPdfModuleFailure = async error => {
  // PDF.js catches the denied canvas addon internally, then fails while
  // constructing DOMMatrix. Match the actual cached module error by identity;
  // an unrelated source ReferenceError must retain its source-failure outcome.
  try {
    if (process.permission?.has('addons') !== false) return false
    const candidates=[],seen=new Set()
    for(let current=error;current&&typeof current==='object'&&!seen.has(current)&&seen.size<8;
      current=Object.getOwnPropertyDescriptor(current,'cause')?.value){
      seen.add(current)
      if(current instanceof ReferenceError&&Object.getOwnPropertyDescriptor(current,'message')?.value==='DOMMatrix is not defined')candidates.push(current)
    }
    if(!candidates.length)return false
    try { await import('pdfjs-dist/legacy/build/pdf.mjs') } catch (moduleError) { return candidates.includes(moduleError) }
  } catch {}
  return false
}

// Called only by the restricted child process. Block database connections before
// importing company code, including scripts with obsolete import-time runners.
export async function auditExtraction(provider, { outputDirectory, capturePublicAts = false } = {}) {
  const mongoose = (await import('mongoose')).default
  const blocked = () => { const error = new Error('Database access disabled during extraction audit'); error.code = 'AUDIT_DATABASE_BLOCKED'; throw error }
  mongoose.connect = blocked
  mongoose.createConnection = blocked
  mongoose.Connection.prototype.openUri = blocked
  const { MongoClient } = await import('mongodb')
  MongoClient.connect = blocked
  MongoClient.prototype.connect = blocked
  const attemptedAt = new Date().toISOString()
  let capture
  try {
    initializeScraperProxyEnvironment()
    if (capturePublicAts) capture = createPublicAtsAuditCapture(provider, { outputDirectory })
    const { createCatalogScraper } = await import('../scraper-support/providers/index.js')
    const jobs = await createCatalogScraper(provider).run({ dryRun: true, persist: false, enqueueAlerts: false,
      ...(capture ? { fetchJson: capture.fetchJson } : {}) })
    if (!Array.isArray(jobs)) throw new Error('Invalid extraction response')
    const inventoryEvidence = readInventoryEvidence(jobs)
    const complete = isFreshCompleteInventoryEvidence(inventoryEvidence)
    const analysis = analyzePublishableJobs(jobs)
    const detailHealth = extractionDetailHealth(analysis.indiaJobs)
    return { source: provider.source, mode: 'isolated-direct-live-extraction-no-database', productionWrites: false,
      attemptedAt, completedAt: new Date().toISOString(),
      outcome: complete && detailHealth.complete ? analysis.eligibleJobs.length ? 'complete-positive-extraction' : 'complete-no-eligible-jobs'
        : jobs.length ? 'positive-extraction-incomplete-evidence' : 'unverified-zero',
      ...extractionRawJobMetrics(provider, jobs, inventoryEvidence), extractedJobs: jobs.length,
      indiaJobs: analysis.indiaJobs.length, eligibleJobs: analysis.eligibleJobs.length,
      inventoryEvidence, detailHealth, filterCounts: analysis.filterCounts, jobs,
      ...(capture ? { retainedNativeApiEvidence: capture.evidence } : {}),
    }
  } catch (error) {
    const completedAt = new Date().toISOString()
    const pdfRuntimeBlocked = await restrictedPdfModuleFailure(error)
    const permissionBlocked = pdfRuntimeBlocked || ['ERR_ACCESS_DENIED', 'ERR_DLOPEN_DISABLED'].includes(error?.code)
    const retainedFailureEvidence = retainNativeFailureArtifact(error, {
      outputDirectory, source: provider.source, attemptedAt, completedAt,
    })
    return { source: provider.source, mode: 'isolated-direct-live-extraction-no-database', productionWrites: false,
      attemptedAt, completedAt,
      outcome: permissionBlocked ? 'audit-permission-blocked' : 'extraction-failed',
      ...extractionFailureDetails(error),
      ...(permissionBlocked ? { failureKind: 'audit_permission_blocked' } : {}),
      ...(pdfRuntimeBlocked ? {
        auditRuntimeLimitation: { capability: 'native-addons', component: 'pdfjs-dist', allowed: false } } : {}),
      failureReason: extractionFailureReason(error),
      ...(retainedFailureEvidence ? { retainedFailureEvidence } : {}),
      ...(capture ? { retainedNativeApiEvidence: capture.evidence } : {}),
      failureCode: pdfRuntimeBlocked ? 'AUDIT_NATIVE_ADDONS_UNAVAILABLE'
        : typeof error?.code === 'string' && /^[A-Z_0-9]{1,80}$/.test(error.code) ? error.code : 'EXTRACTION_OR_UPSTREAM_ERROR',
      rawJobs: null, rawJobsBasis: 'unavailable-failed-attempt', indiaJobs: null, eligibleJobs: null, inventoryEvidence: null,
    }
  }
}

if (process.send) {
  process.once('message', async ({ provider, outputDirectory, capturePublicAts }) => {
    const result = await auditExtraction(provider, { outputDirectory, capturePublicAts })
    process.send(result, () => process.exit(0))
  })
}
