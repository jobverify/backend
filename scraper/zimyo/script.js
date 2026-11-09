import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createVerifiedCareersEmptyStateScraper } from './verifiedCareersEmptyState.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "zimyo"
export const COMPANY = "Zimyo"
export const CAREERS_URL = "https://www.zimyo.com/about/career/"
export const DISPOSITION = "verified-first-party-careers-empty-result"
export const VERIFIED_ON = "2026-07-30"
export const VERIFIED_SURFACE_SUMMARY = "Verified on Thursday, July 30, 2026 that https://www.zimyo.com/about/career/ was the live first-party Zimyo careers page, and that its public Job Openings section exposed no active job listings while directing candidates to career@zimyo.com instead. This provider now uses the verified first-party empty-state scraper instead of a generic sentinel until Zimyo publishes real public openings on its official careers surface."

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
