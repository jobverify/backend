import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createVerifiedCareersEmptyStateScraper } from './verifiedCareersEmptyState.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "basepair"
export const COMPANY = "Basepair"
export const CAREERS_URL = "https://www.basepairtech.com/careers/"
export const DISPOSITION = "verified-first-party-careers-empty-result"
export const VERIFIED_ON = "2026-07-30"
export const VERIFIED_SURFACE_SUMMARY = "Verified on Thursday, July 30, 2026 that https://www.basepairtech.com/careers/ was the live first-party Basepair careers page, and that its public Current Positions section exposed no active job listings while explicitly telling candidates that if there are no open positions they can still email careers@basepairtech.com with a resume and cover letter. This provider now uses the verified first-party empty-state scraper instead of a generic sentinel until Basepair publishes real public openings on its official careers surface."

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
