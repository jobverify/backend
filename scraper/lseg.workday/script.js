import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

export const CAREER_PAGE_URL = 'https://www.lseg.com/en/careers'
export const BASE_URL = 'https://lseg.wd3.myworkdayjobs.com/Careers'
export const COMPANY_NAME = 'London Stock Exchange Group (LSEG)'
export const SOURCE = 'lseg'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir,
})

export const createLsegScraper = ({
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  run: ({ signal } = {}) => workdayRunner({
    ...buildScraperOptions(),
    ...(signal === undefined ? {} : { signal }),
  }),
})

export const run = async ({
  workdayRunner = runWorkdayScraper,
  signal,
} = {}) =>
  createLsegScraper({ workdayRunner }).run({ signal })
