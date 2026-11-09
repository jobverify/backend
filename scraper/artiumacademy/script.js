import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createVerifiedCareersEmptyStateScraper } from './verifiedCareersEmptyState.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "artiumacademy"
export const COMPANY = "Artium Academy"
export const CAREERS_URL = "https://artiumacademy.com/careers"
export const DISPOSITION = "verified-first-party-careers-empty-result"
export const VERIFIED_ON = "2026-07-30"
export const VERIFIED_SURFACE_SUMMARY = "Verified on Thursday, July 30, 2026 that https://artiumacademy.com/careers was the live first-party Artium Academy careers page, that it explicitly showed We are currently hiring... above the job filter shell, and that the same public page then stated No jobs available with no trustworthy public opening cards or detail links. This provider now uses the verified first-party empty-state scraper instead of a generic sentinel until Artium Academy publishes real public openings on its official careers surface."

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
