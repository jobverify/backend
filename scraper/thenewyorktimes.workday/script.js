import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRemainingRecruitmentBatchSource } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'

export const SOURCE = "thenewyorktimes"
export const COMPANY = "The New York Times"
export const CAREERS_URL = "https://proxy.douxx.tech/?force=true&ua=true&url=https%3A%2F%2Fwww.nytco.com%2Fcareers%2F%23main"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
export const run = options => runRemainingRecruitmentBatchSource(SOURCE, options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
