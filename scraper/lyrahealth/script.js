import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createNativeLyraScraper} from './native.js'

export const SOURCE = "lyrahealth"
export const COMPANY = "Lyra Health"
export const CAREERS_URL = "https://careers.lyrahealth.com/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = '2026-11-05'
export const VERIFIED_SURFACE_SUMMARY = 'The current corporate-bound public account publishes 482 native records; seven own typed India roles reconcile with full visible criteria and closing models. Complete company inventory and lifecycle cleanup remain unverified.'
export {createNativeLyraScraper}
export const run = options => createNativeLyraScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
