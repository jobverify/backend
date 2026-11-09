import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createVerifiedCareersEmptyStateScraper } from './verifiedCareersEmptyState.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "alaan"
export const COMPANY = "Alaan"
export const CAREERS_URL = "https://www.alaan.com/careers"
export const DISPOSITION = "current-first-party-careers-context-incomplete"
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = "The current configured anonymous careers document exposes hiring and loading context. Native vacancy enumeration is unqualified; native, company and India totals remain unknown, inventory is incomplete, and lifecycle cleanup is forbidden."

export const run = async (options = {}) => createVerifiedCareersEmptyStateScraper().run(options)

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
