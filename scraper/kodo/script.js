import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createKodoScraper} from './currentNative.js'

export const SOURCE = "kodo"
export const COMPANY = "Kodo"
export const CAREERS_URL = "https://www.kodo.com/careers"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Finite current native criteria-as-data only; publication, formal legal entity, complete company, rendered/application and lifecycle cleanup remain unverified.'
export {createKodoScraper}
export const run = options => createKodoScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
