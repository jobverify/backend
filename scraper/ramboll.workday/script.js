import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRambollCurrentPublication } from './currentPublication20261119.js'

export const SOURCE = "ramboll"
export const COMPANY = "Ramboll"
export const CAREERS_URL = "https://www.ramboll.com/careers"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = '2026-11-19'
export const VERIFIED_SURFACE_SUMMARY = 'Current own declared native India records, all country pages and whole publication closing; full application controls, renderer supplements, company inventory and cleanup remain unverified.'
export const run = options => runRambollCurrentPublication(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
