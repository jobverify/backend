import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentKarza} from './currentNative20261120.js'

export const SOURCE = "karzatechnologies"
export const COMPANY = "Karza Technologies"
export const CAREERS_URL = "https://cutshort.io/company/karza-technologies-96-N8gUopJW"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = '2026-11-20'
export const VERIFIED_SURFACE_SUMMARY = 'Current configured exact company native alias identity, direct-employer vacancy, explicit workplace country and same-role profile handoff are reconciled at closing; agency and parent records are held and company inventory remains unknown.'
export const run = options => runCurrentKarza(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
