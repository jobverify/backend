import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRecruitmentBatchSource } from '../../scraper-support/utils/recruitmentBatch20261103.js'

export const SOURCE = "apacorporation"
export const COMPANY = "APA Corporation"
export const CAREERS_URL = "https://careers.apachecorp.com/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runRecruitmentBatchSource(SOURCE, options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
