import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createWorkablePublicApiScraper } from '../../scraper-support/utils/workablePublicApi.js'
import PROVIDER_METADATA from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "bestexresearch"
export const COMPANY = "BestEx Research"
export { PROVIDER_METADATA }
export const CAREERS_URL = 'https://www.bestexresearch.com/careers'
export const DISPOSITION = 'live-parser'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const run = async (options = {}) => createWorkablePublicApiScraper({
  source: SOURCE, company: COMPANY, tenant: 'bestex-research',
  accountUid: '15159d62-62e0-4df7-a2f4-f3d7d33855e5',
  careersUrl: CAREERS_URL, companyDomain: 'bestexresearch.com', boardIdentityVerified: true,
  requiredContentSections: ['description'],
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
