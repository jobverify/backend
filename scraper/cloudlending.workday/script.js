import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

export const SOURCE = 'cloudlending'
export const COMPANY_NAME = 'Cloud Lending'
export const CAREER_PAGE_URL = 'https://www.q2.com/company/why-work-at-q2/careers'
export const BASE_URL = 'https://q2ebanking.wd5.myworkdayjobs.com/Q2'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'
export const VERIFIED_ON = '2026-07-14'
export const VERIFIED_SURFACE_SUMMARY =
  'The legacy Cloud Lending domain now hands off to Q2, and Q2’s official careers page links to a public Workday board for India roles.'
export const LEGACY_REDIRECT_CHAIN = [
  'https://cloudlendinginc.com/',
  'https://www.q2.com/fintech/lending',
  'https://www.q2.com/products/digital-banking/altfi-lending',
  'https://www.q2.com/',
]

const scraperDir = path.dirname(fileURLToPath(import.meta.url))

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir,
})

export const createCloudLendingScraper = () => ({
  async run({
    workdayRunner = runWorkdayScraper,
    signal,
  } = {}) {
    return workdayRunner({
      ...buildScraperOptions(),
      ...(signal === undefined ? {} : { signal }),
    })
  },
})

export const run = async ({
  workdayRunner = runWorkdayScraper,
  signal,
} = {}) =>
  createCloudLendingScraper().run({ workdayRunner, signal })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(scraperDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
