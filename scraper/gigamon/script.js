import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNative } from './native.js'
import { PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "gigamon"
export const COMPANY = "Gigamon"
export { PROVIDER_METADATA }
export const CAREERS_URL = 'https://www.gigamon.com/company/careers.html'
export const DISPOSITION = 'official-native-Jobvite-India-coverage-gap'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Full official Jobvite native descriptions and corroborated India addresses; legal employer, requisition semantics, first-ever publication and whole-employer scope unknown. Cleanup forbidden.'

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
