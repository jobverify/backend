import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import provider from './catalog.js'
import { createPublicAtsCatalogScraper } from '../../scraper-support/providers/index.js'
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const run = options => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.clearco).run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
