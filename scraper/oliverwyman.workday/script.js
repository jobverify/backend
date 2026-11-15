import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentOliverWyman } from './currentNative20261115.js'

export const SOURCE = "oliverwyman"
export const COMPANY = "Oliver Wyman"
export const CAREERS_URL = "https://www.oliverwyman.com/careers.html"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current own Oliver Wyman delegation and branded India search preserve complete original native role criteria, employer, all typed country alternatives and independent current closing. Company inventory, ambiguous dates, zero, cleanup and rendered application operation remain unqualified.'
export const run = options => runCurrentOliverWyman(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
