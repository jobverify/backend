import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createEmployerBoundComeetScraper } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "firebolt"
export const COMPANY = "Firebolt"
export const CAREERS_URL = 'https://www.firebolt.io/careers'
export const DISPOSITION = 'current-corporate-bound-native-Comeet-extraction'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Revalidate current corporate Comeet handoffs, reciprocal company identity, public native literal company/position data and advertised client. Read all current public details and reconcile closing snapshots. Preserve native sections and revision strings; publication, unlocated postings and whole-company coverage remain unknown.'

const config = {
  source: SOURCE, companyName: COMPANY, careersUrl: CAREERS_URL, companyDomain: 'firebolt.io',
  nativeSlug: 'firebolt', nativeCompanyUid: '26.004',
  nativeRoleDescriptionHeading: 'About the role',
  nativeClientSHA256: '664680f59b3640c168c58230a2f95965ff334c15937555dfd33b39f7dfca1ea4',
}
export const run = options => createEmployerBoundComeetScraper(config).run(options)

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
