import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRecruitmentBatchSource } from '../../scraper-support/utils/recruitmentBatch20261103.js'

// Historical public helper exports remain available; the production run below
// uses the current recruitment extractor. Historical notes are not live proof.
export * from './historicalBoundary20261103.js'

export const SOURCE = "zestmoney"
export const COMPANY = "ZestMoney"
export const CAREERS_URL = "https://www.zestmoney.in/join-us-1/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runRecruitmentBatchSource(SOURCE, options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
