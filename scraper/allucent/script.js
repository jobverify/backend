import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createWorkablePublicApiScraper } from '../../scraper-support/utils/workablePublicApi.js'
import ALLUCENT_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "allucent"
export const COMPANY = "Allucent"
export const PROVIDER_METADATA = ALLUCENT_CATALOG
export const CAREERS_URL = 'https://www.allucent.com/careers'
export const WORKABLE_BOARD_URL = 'https://apply.workable.com/allucent/'
export const DISPOSITION = 'live-parser'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const run = async (options = {}) => createWorkablePublicApiScraper({
  source: SOURCE, company: COMPANY, tenant: 'allucent',
  accountUid: '7e3163b7-6595-472a-8fb6-7424218ed72b',
  careersUrl: CAREERS_URL, companyDomain: 'allucent.com', boardIdentityVerified: true,
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
