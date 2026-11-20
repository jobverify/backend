import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runCurrentPublications} from './currentNative20261120.js'

export const SOURCE = "island"
export const COMPANY = "Island"
export const CAREERS_URL = "https://www.island.io/careers"
export const DISPOSITION = 'current-native-partial-publications'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current own published roles require authored India workplace and the current same-ID declared application loader. Full renderer, application controls, company inventory and cleanup remain unverified.'
export const run = options => runCurrentPublications(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
