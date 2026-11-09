import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runEvonikNative } from './nativeCurrent.js'

export const SOURCE = "evonik"
export const COMPANY = "Evonik"
export const CAREERS_URL = "https://www.evonik.com/en/careers.html"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runEvonikNative(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
