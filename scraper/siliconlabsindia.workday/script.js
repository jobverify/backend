import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

export const CAREER_PAGE_URL = 'https://www.silabs.com/about-us/careers'
export const BASE_URL = 'https://silabs.wd1.myworkdayjobs.com/SiliconlabsCareers'
export const COMPANY_NAME = 'Silicon Labs India'
export const SOURCE = 'siliconlabsindia'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: BASE_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir,
})

export const createSiliconLabsIndiaScraper = ({
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
  createSiliconLabsIndiaScraper({ workdayRunner }).run({ signal })
