import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runVahanCurrentNative, VAHAN_CAREERS } from './currentNative20261113.js'

export const SOURCE = "vahan"
export const COMPANY = "Vahan"
export const CAREERS_URL = VAHAN_CAREERS
export const DISPOSITION = 'current-first-party-native-html'
export const VERIFIED_ON = '2026-11-13'
export const VERIFIED_SURFACE_SUMMARY = 'Current employer careers HTML and full role criteria; whole-company scope remains unverified and cleanup is forbidden.'
export const run = options => runVahanCurrentNative(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
