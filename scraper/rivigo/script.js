import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRemainingRecruitmentBatchSource, remainingRecruitmentBatchProvider } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'

// Historical helper exports retain their original semantics; production run collects current evidence.
export * from './historicalBoundary20261103.js'

export const SOURCE = "rivigo"
export const COMPANY = "Rivigo"
export const CAREERS_URL = "https://careers-rivigo.flexiele.com/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
export const run = options => runRemainingRecruitmentBatchSource(SOURCE, options)
export const PROVIDER_METADATA = remainingRecruitmentBatchProvider(SOURCE)
export const createRivigoScraper = (defaults = {}) => ({ name: SOURCE, run: (options = {}) => run({ ...defaults, ...options }) })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
