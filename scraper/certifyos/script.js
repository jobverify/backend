import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAshbyApiScraper } from '../../scraper-support/utils/ashbyApi.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'certifyos'
export const COMPANY = 'CertifyOS'
export const ASHBY_BOARD_SLUG = 'certifyos'
export const ASHBY_PUBLIC_BOARD_URL = 'https://jobs.ashbyhq.com/certifyos'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/certifyos'

export const createCertifyOSScraper = (options = {}) => createAshbyApiScraper({
  source: SOURCE,
  companyName: COMPANY,
  ashbyJobBoardUrl: ASHBY_JOB_BOARD_URL,
  ...options,
})

export const createScraper = createCertifyOSScraper
export const run = async (options = {}) => createCertifyOSScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
