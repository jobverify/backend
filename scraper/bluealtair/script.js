import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createWorkablePublicApiScraper } from '../../scraper-support/utils/workablePublicApi.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "bluealtair"
export const COMPANY = "Blue Altair"
export const CAREERS_URL = 'https://www.bluealtair.com/careers'
export const DISPOSITION = 'live-parser'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Official corporate careers links the exact blue-altair Workable tenant. Native board account identity and full paginated public inventory are validated; original publication dates are retained.'

export const run = async (options = {}) => createWorkablePublicApiScraper({
  source: SOURCE, company: COMPANY, tenant: 'blue-altair',
  accountUid: 'dfa400ea-5469-4a7e-aa7f-1956427ddc51',
  careersUrl: CAREERS_URL, companyDomain: 'bluealtair.com', boardIdentityVerified: true,
  requiredContentSections: ['description', 'requirements', 'benefits'],
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
