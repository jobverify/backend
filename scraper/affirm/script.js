import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "affirm"
export const COMPANY = "Affirm"
export const CAREERS_URL = 'https://www.affirm.com/careers'
export const JOBS_API = 'https://boards-api.greenhouse.io/v1/boards/affirm/jobs?content=true'

export const run = options => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.affirm).run(options)

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
