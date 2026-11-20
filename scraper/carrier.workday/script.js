import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentNative, PROFILE } from './currentNative20261119.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = PROFILE.source
export const COMPANY = PROFILE.company
export const CAREERS_URL = PROFILE.chain[0].url
export const DISPOSITION = 'current-first-party-native-published-subset-company-coverage-held'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current own employer pages and public native role criteria, workplace countries, original dates and exact native applications are reconciled each run. Remaining pagination, whole-company totals and backend application activation remain unproven; cleanup stays disabled.'
export const run = runCurrentNative

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
