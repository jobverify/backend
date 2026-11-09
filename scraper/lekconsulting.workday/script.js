import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRemainingRecruitmentBatchSource } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'

export const SOURCE = "lekconsulting"
export const COMPANY = "LEK Consulting"
export const CAREERS_URL = "https://lek.tal.net/vx/lang-en-GB/mobile-0/appcentre-1/brand-2/candidate/so/pm/1/pl/1/opp/4121-London-Office-Summer-Associate-2027/en-GB"
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
