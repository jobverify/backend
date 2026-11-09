import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRecruitmentBatchSource } from '../../scraper-support/utils/recruitmentBatch20261103.js'

export const SOURCE = "espn"
export const COMPANY = "ESPN"
export const CAREERS_URL = "https://www.disneycareers.com/en/search-jobs?acm=ALL&alrpm=ALL&ascf=%5B%7B%22key%22:%22custom_fields.IndustryCustomField%22,%22value%22:%22ESPN%22%7D%5D"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runRecruitmentBatchSource(SOURCE, options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
