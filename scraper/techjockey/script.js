import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRecruitmentBatchSource } from '../../scraper-support/utils/recruitmentBatch20261103.js'

// Preserve historical public helper exports while the production run below
// collects current recruitment data. Historical metadata is not live proof.
export * from './historicalBoundary20261103.js'

export const SOURCE = "techjockey"
export const COMPANY = "Techjockey"
export const CAREERS_URL = "https://www.techjockey.com/company/careers"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runRecruitmentBatchSource(SOURCE, options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
