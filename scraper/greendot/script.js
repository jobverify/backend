import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createGreendotCollector } from './native.js'
export { createGreendotCollector } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "greendot"
export const COMPANY = "Green Dot"
export const CAREERS_URL = 'https://www.greendot.com/working-here'
export const DISPOSITION = 'official-bound-native-workday-partial-company-scope'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Exact official Workday API/canonical identities are checked independently; native observations do not establish whole-company or India completeness.'

export const run = async (options = {}) => createGreendotCollector({
  fetchImpl: options.fetchImpl, runEngine: options.runEngine, requestScheduler: options.requestScheduler,
  now: options.now, requestTimeoutMs: options.requestTimeoutMs,
}).run(options)

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
