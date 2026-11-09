import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CAREERS, runNativeEntegris } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "entegris"
export const COMPANY = "Entegris"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'current-official-redirect-native-Workday-India-facet'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Reverify the current first-party careers handoff, native country facet, full role identity/content/dates and selected inventory. Other company recruitment channels and publication remain unknown.'

export const run = options => runNativeEntegris(options)

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
