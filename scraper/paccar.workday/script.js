import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPaccarPublications } from './currentPublication20261119.js'

export const SOURCE = "paccar"
export const COMPANY = "PACCAR"
export const CAREERS_URL = "https://prod-cms.paccar.com/careers"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = '2026-11-19'
export const VERIFIED_SURFACE_SUMMARY = 'Current own native RMK publications, exact employer, whole workplace, country, authored criteria, dates and same-role application links; full renderer, application controls, company inventory and cleanup remain unverified.'
export const run = options => runPaccarPublications(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
