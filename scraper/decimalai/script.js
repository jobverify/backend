import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentDecimalProgramme } from './currentProgramme.js'

export const SOURCE = "decimalai"
export const COMPANY = "Decimal AI"
export const CAREERS_URL = "https://www.decimal.app/careers"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runCurrentDecimalProgramme(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
