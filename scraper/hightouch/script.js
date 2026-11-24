import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runCurrentConfiguredBoard } from './currentConfiguredBoard20261121.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "hightouch"
export const COMPANY = "Hightouch"
export const CAREERS_URL = 'https://hightouch.com/careers'
export const DISPOSITION = 'current-own-Next-declared-native-advertised-listed-India-projection'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Qualify current own advertised Next role cards, actual connected role-specific public-job account metadata, complete native board and documented full feed. Missing countries remain null; explicit advertised foreign regional or matching role-exclusive criteria can exclude India. Company totals, legal employer, country facets, application activation and cleanup remain unverified.'

export const run = options => runCurrentConfiguredBoard(options)

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
