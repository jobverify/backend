import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { LICIOUS_CATALOG } from './catalog.js'
import { createNativeLiciousScraper } from './nativeInventory.js'
export { CAREERS_URL, CURRENT_JOBS_URL, PUBLIC_PORTAL_URL, LISTING_API_URL, TENANT_URL, DETAIL_URL, PUBLICATION_DATES_URL } from './nativeInventory.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url)), config = loadConfig(currentDir)
export const PROVIDER_METADATA = LICIOUS_CATALOG
export const SOURCE = 'licious', COMPANY = 'Licious', OFFICIAL_BRAND_NAME = 'Licious'
export const VERIFIED_ON = LICIOUS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = LICIOUS_CATALOG.verifiedSurfaceSummary
export const createLiciousScraper = (options = {}) => createNativeLiciousScraper({ maxJobs: Number.isInteger(config.maxJobs) ? config.maxJobs : 0, ...options })
export const run = async (options = {}) => createLiciousScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
