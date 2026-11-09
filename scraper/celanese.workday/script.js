import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNative } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "celanese"
export const COMPANY = "Celanese"
export const CAREERS_URL = 'https://asiacareers-celanese.icims.com/jobs/search?ss=1&mobile=false&width=1065&height=500&bga=true&needsRedirect=false&jan1offset=330&jun1offset=330'
export const DISPOSITION = 'first-party-celanese-regional-icims-html'

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
