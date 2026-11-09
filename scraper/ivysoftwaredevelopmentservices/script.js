import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createBlockedSurfaceScraper,
  hasOfficialContactSignal,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
} from '../ivy/script.js'
import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const OFFICIAL_BRAND_NAME = provider.officialBrandName
export const HOMEPAGE_URL = provider.homepageUrl
export const CONTACT_URL = provider.contactPageUrl
export const BLOCKED_ROUTE_URLS = [...provider.blockedRouteUrls]
export {
  hasOfficialContactSignal,
  hasOfficialHomepageSignal,
  hasPublicJobsSignal,
}

export const createIvySoftwareDevelopmentServicesScraper = () =>
  createBlockedSurfaceScraper(PROVIDER_METADATA)

export const run = async (options = {}) =>
  createIvySoftwareDevelopmentServicesScraper().run(options)

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
