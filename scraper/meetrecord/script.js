import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentPublications} from './currentNative20261120.js'

export const SOURCE = "meetrecord"
export const COMPANY = "MeetRecord"
export const CAREERS_URL = "https://www.outdoo.ai/positions/sr-product-manager"
export const DISPOSITION = 'current-native-partial-publications'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current first-party MeetRecord legal/rebrand proof, exact whole role India workplace and active authored application handoff qualify partial publications. Full renderer, application controls, company inventory and cleanup remain unverified.'
export const run = options => runCurrentPublications(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
