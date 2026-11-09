import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRemainingRecruitmentBatchSource } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'

export const SOURCE = "skyworkssolutions"
export const COMPANY = "Skyworks Solutions"
export const CAREERS_URL = "https://www.cience.com/company/skyworks-solutions/5383817139664178589"
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
