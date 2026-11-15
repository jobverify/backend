import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentMeetrecord } from './currentNative20261115.js'

export const SOURCE = "meetrecord"
export const COMPANY = "MeetRecord"
export const CAREERS_URL = "https://www.outdoo.ai/positions/sr-product-manager"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current extraction is implemented; complete and empty company inventories remain unverified.'
export const run = options => runCurrentMeetrecord(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
