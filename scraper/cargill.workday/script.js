import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeCargill } from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "cargill"
export const COMPANY = "Cargill"
export const CAREERS_URL = 'https://careers.cargill.com/en/search-jobs'
export const DISPOSITION = 'current-native-India-filter-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current official country-filter pages and SAP/RMK full roles are reconciled at runtime; company-wide scope remains unproven.'

export const run = options => runNativeCargill(options)

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
