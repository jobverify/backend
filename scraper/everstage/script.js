import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeEverstage } from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "everstage"
export const COMPANY = "Everstage"
export const CAREERS_URL = 'https://www.everstage.com/careers'
export const DISPOSITION = 'current-advertised-public-Rippling-native-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current official Rippling widget, terminal native listing, full role descriptions, typed India geography and advertised native application configuration are reconciled each run. Publication dates and whole-company counts remain unknown.'

export const run = options => runNativeEverstage(options)

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
