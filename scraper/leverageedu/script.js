import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentLeverageEdu } from './currentNative20261119.js'

export const SOURCE = "leverageedu"
export const COMPANY = "Leverage Edu"
export const CAREERS_URL = "https://leverageedu.com/work-with-us/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current own native listings, declared public API/programs and real application handoffs are acquired on both boundaries. Listed roles with unavailable applications remain explicit holds; company inventory and cleanup are unverified.'
export const run = options => runCurrentLeverageEdu(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
