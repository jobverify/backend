import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'cengage'
export const COMPANY = 'Cengage'
export const CAREERS_URL = 'https://www.cengagegroup.com/careers/'
export const BOARD_URL = 'https://cengage.wd5.myworkdayjobs.com/CengageIndiaCareers'
export const DISPOSITION = 'current-official-workday-India-board-native-country-proof'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'The current corporate handoff, complete selected India board, native country addresses, full descriptions and closing listing identities are checked each run. Other Cengage career boards remain outside this implementation; whole-company scope is unknown.'

export const run = async (options = {}) => {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(120000)])
  signal.throwIfAborted()
  let jobs
  try {
    jobs = await runWorkdayScraper({ ...options, signal, source: SOURCE, company: COMPANY,
      baseUrl: BOARD_URL, scraperDir: currentDir, boardIdentityVerified: true,
      nativeDetailRecovery: options.nativeDetailRecovery ?? false })
  } catch (error) { signal.throwIfAborted(); throw error }
  signal.throwIfAborted()
  const evidence = readInventoryEvidence(jobs)
  for (const job of jobs) Object.assign(job, { sourceDescription: job.sourceDescription || job.jobDescription,
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    sourceNativeBoardScope: 'CengageIndiaCareers' })
  return attachInventoryEvidence(jobs, { ...evidence, status: 'discovery-only', listingComplete: false,
    reportedTotal: null, indiaFacetCount: null,
    reason: `current-corporate-CengageIndiaCareers-native-country-proof;observed-board-roles=${evidence?.reportedTotal ?? 'unknown'};returned-india-details=${jobs.length};other-company-boards-unverified` })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
