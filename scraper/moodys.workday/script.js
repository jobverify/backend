import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remainingRecruitmentBatchProvider } from '../../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import { runMoodyTalentbrewInventory } from '../moodyscorporation.workday/talentbrewNative.js'

export const SOURCE = "moodys"
export const COMPANY = "Moody's"
export const CAREERS_URL = "https://careers.moodys.com/en/search-jobs"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
export const run = options => runMoodyTalentbrewInventory(remainingRecruitmentBatchProvider(SOURCE), options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
