import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeAqua, CAREERS } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "aquasecurity"
export const COMPANY = "Aqua Security"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'current-first-party-Comeet-native-details'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current first-party listed roles, explicit native country, visible full descriptions, public application identity and closing listed inventory are checked each run. Whole-company scope remains unknown.'

export const run = options => runNativeAqua(options)

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
