import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeCloudBees, CAREERS } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "cloudbees"
export const COMPANY = "CloudBees"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'current-official-Paylocity-native-feed-and-public-details'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current official feed binding, native employer/account, public visibility, explicit country, full native API content and native publication dates are reconciled. Whole-company scope remains unknown.'

export const run = options => runNativeCloudBees(options)

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
