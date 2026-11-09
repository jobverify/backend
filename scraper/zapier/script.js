import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNative } from './nativeCareers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zapier'
export const COMPANY = 'Zapier'
export const ASHBY_BOARD_SLUG = 'zapier'
export const ASHBY_PUBLIC_BOARD_URL = 'https://jobs.ashbyhq.com/zapier'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/zapier'

export const createZapierScraper = (options = {}) => ({ run: (runOptions = {}) => runNative({ ...options, ...runOptions }) })

export const createScraper = createZapierScraper
export const run = async (options = {}) => createZapierScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
