import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createVerifiedCareersEmptyStateScraper } from './verifiedCareersEmptyState.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "securonixindia"
export const COMPANY = "Securonix India"
export const CAREERS_URL = "https://www.securonix.com/company/careers/"
export const DISPOSITION = "verified-first-party-careers-empty-result"
export const VERIFIED_ON = "2026-07-25"
export const VERIFIED_SURFACE_SUMMARY = "Verified on Saturday, July 25, 2026 that https://www.securonix.com/company/careers/ was the live first-party careers surface for Securonix India and exposed zero trustworthy public jobs. The dedicated batch-04 snapshot scraper returns this authoritative empty result; a future review must replace it with a parser before publishing jobs."

export const run = async () => createVerifiedCareersEmptyStateScraper().run()

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
