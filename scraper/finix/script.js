import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeFinix } from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "finix"
export const COMPANY = "Finix"
export const CAREERS_URL = 'https://finix.com/careers'
export const DISPOSITION = 'public-Lever-native-scope-with-partial-preservation'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current official Finix Lever tenant uses the existing shared adapter with native secondary-location guards. Generic Remote scopes retain incomplete evidence; original publication dates and India-capable totals remain unknown.'

export const run = options => runNativeFinix(options)

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
