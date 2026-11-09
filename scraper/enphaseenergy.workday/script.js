import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runNativeEnphase} from './native.js'
export {parsePage,parseDetail,parseBinding} from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "enphaseenergy"
export const COMPANY = "Enphase Energy"
export const CAREERS_URL = 'https://enphase.com/careers'
export const DISPOSITION = 'current-public-corporate-API-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current corporate client, finite API inventory and full India corporate details are reconciled per run. Whole-company totals, posting dates and application access remain unqualified.'

export const run = options => runNativeEnphase(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
