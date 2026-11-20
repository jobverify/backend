import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentNative } from './currentNative20261119.js'

export const SOURCE = "concentrix"
export const COMPANY = "Concentrix"
export const CAREERS_URL = "https://jobs.concentrix.com/"
export const DISPOSITION = 'current-own-native-published-country-cohort-company-coverage-held'
export const run = runCurrentNative

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
