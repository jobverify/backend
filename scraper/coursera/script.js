import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNative } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "coursera"
export const COMPANY = "Coursera"
export const CAREERS_URL = 'https://careers.coursera.com/jobs/search/careers'
export const DISPOSITION = 'first-party-coursera-native-html'

export const run = options => runNative(options)

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
