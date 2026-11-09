import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNative } from './native.js'
import { PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "arrowelectronics"
export const COMPANY = "Arrow Electronics"
export { PROVIDER_METADATA }
export const CAREERS_URL = 'https://careers.arrow.com/us/en'
export const DISPOSITION = 'official-native-Phenom-India-coverage-gap'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Arrow same-domain ARELUS native public search and full detail models; legal employer, first-ever publication and whole-company completeness unknown. Cleanup forbidden.'

export const run = (options = {}) => runNative(options)

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
