import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeEvidation } from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "evidation"
export const COMPANY = "Evidation"
export const CAREERS_URL = 'https://evidation.com/open-positions'
export const DISPOSITION = 'current-corporate-bound-native-rippling-extraction'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Revalidate the current visible corporate Rippling widget, loader delegation, unfiltered native pagination, every public role detail and closing snapshot. Preserve full employer content and creation metadata; publication dates and whole-company coverage remain unverified.'

export const run = options => runNativeEvidation(options)

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
