import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEmployerBoundWorkableScraper } from '../../scraper-support/utils/workableEmployerInventory.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'interpathadvisory'
export const COMPANY = 'Interpath Advisory'
export const CAREERS_URL = 'https://interpath.com/careers/'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Verify the current corporate-to-Workable handoff and reciprocal native employer identity, reconcile unfiltered cursors and India details, and retain original publication dates and full employer content sections. Other company recruitment channels remain unverified.'

const config = {
  source: SOURCE, company: COMPANY, careersUrl: CAREERS_URL, companyDomain: 'interpath.com',
  tenant: 'interpath-advisory', accountUid: 'cd3c9aad-6b22-4c6b-af81-2c371b32e829',
  reconcileClosingInventory: true,
}

export const run = async (options = {}) => {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(180000)])
  signal.throwIfAborted()
  const jobs = await createEmployerBoundWorkableScraper(config).run({ ...options, signal })
  signal.throwIfAborted()
  for (const job of jobs) Object.assign(job, {
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
  })
  const evidence = readInventoryEvidence(jobs)
  return attachInventoryEvidence(jobs, { ...evidence, status: 'coverage-gap', listingComplete: false,
    reportedTotal: null, indiaFacetCount: null,
    reason: 'current-bound-Workable-surface;whole-company-scope-unverified;' + evidence.reason })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
