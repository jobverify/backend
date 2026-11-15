import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createKukuFMScraper} from './nativeData20261115.js'

export const SOURCE = "kukufm"
export const COMPANY = "Kuku FM"
export const CAREERS_URL = "https://kukuapp.in/careers/open-roles/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Six finite native role criteria-as-data pairs; corporate/legal/rendered/application/company inventory and cleanup remain unverified.'
export {createKukuFMScraper}
export const run = options => createKukuFMScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
