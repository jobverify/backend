import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

export const CAREER_PAGE_URL = 'https://www.tricentis.com/company/careers'
export const BASE_URL = 'https://tricentis.wd1.myworkdayjobs.com/en-US/Tricentis_Careers'
export const SOURCE = 'tricentis'
export const COMPANY_NAME = 'Tricentis'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: BASE_URL,
  locationCountry: null,
  source: SOURCE,
  scraperDir,
})

export const run = async ({
  workdayRunner = runWorkdayScraper,
  signal,
} = {}) =>
  workdayRunner({
    ...buildScraperOptions(),
    ...(signal === undefined ? {} : { signal }),
  })

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(scraperDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
