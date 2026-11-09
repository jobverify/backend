import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { WORKDAY_COUNTRY_INVENTORY_PROOF } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const workdayDir = path.resolve(currentDir, '../eset.workday')

export const SOURCE = "eset"
export const COMPANY = "ESET"
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.baseUrl
export const DISPOSITION = 'current-official-vanity-bound-workday-partial-company-scope'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const run = async (options = {}) => {
  options.signal?.throwIfAborted()
  const jobs = await runVerifiedWorkdayBoardUnion({
    source: SOURCE, company: COMPANY,
    boards: [{ tenant: 'eset', site: 'ESET_External', baseUrl: WORKDAY_BOARD_URL, scraperDir: workdayDir }],
    // The exact India name is declared by the same role on this bound native
    // tenant/site. Preserve it verbatim; unrelated or similar names stay rejected.
    employerPattern: /^(?:ESET|ESET Software India Private Limited)$/, requireEmployer: true,
    completeSourceScope: false, allowUnresolvedCountryScope: true,
    scopeReason: 'current-eset-workday-board-observed-company-recruitment-scope-unverified',
  }, options)
  options.signal?.throwIfAborted()
  for (const job of jobs) Object.assign(job, { sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false })
  const inventory = readInventoryEvidence(jobs)
  const nativeBoardInventory = jobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
  const observed = nativeBoardInventory.boards.reduce((total, board) => total + board.reportedTotal, 0)
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: {
    source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: observed, observedVacancyCount: observed,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
    nativeBoardInventory,
    provenanceLimit: 'Only the current official-bound native board is observed; whole-company scope, additional surfaces and unqualified legal-employer names remain unknown.',
  } })
  attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: observed, observedVacancyCount: observed, sourceScopeComplete: false })
  return attachInventoryEvidence(jobs, { ...inventory, status: 'coverage-gap', listingComplete: false,
    reportedTotal: null, indiaFacetCount: null, verifiedAt: null,
    reason: 'current-eset-workday-board-observed-company-recruitment-scope-unverified' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
