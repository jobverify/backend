import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createHdfcBankScraper} from './native20261110.js'

export const SOURCE = "hdfcbank"
export const COMPANY = "HDFC Bank"
export const CAREERS_URL = "https://www.hdfc.bank.in/careers"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => createHdfcBankScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
