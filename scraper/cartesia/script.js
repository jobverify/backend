import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAshbyApiScraper } from '../../scraper-support/utils/ashbyApi.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cartesia'
export const COMPANY = 'Cartesia'
export const ASHBY_BOARD_SLUG = 'cartesia'
export const ASHBY_PUBLIC_BOARD_URL = 'https://jobs.ashbyhq.com/cartesia'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/cartesia'

export const createCartesiaScraper = (options = {}) => createAshbyApiScraper({
  source: SOURCE,
  companyName: COMPANY,
  ashbyJobBoardUrl: ASHBY_JOB_BOARD_URL,
  ...options,
})

export const createScraper = createCartesiaScraper
export const run = async (options = {}) => createCartesiaScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
