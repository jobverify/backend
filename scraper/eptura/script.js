import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeEptura } from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "eptura"
export const COMPANY = "Eptura"
export const CAREERS_URL = 'https://eptura.com/careers/'
export const DISPOSITION = 'current-advertised-public-Pinpoint-native-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current official Pinpoint delegation, typed India geography, full descriptions, native original dates and advertised public application entries are reconciled each run. Whole-company counts remain unknown.'

export const run = options => runNativeEptura(options)

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
