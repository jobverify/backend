import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

export const CAREER_PAGE_URL = 'https://awavesemi.com/careers/india-job-openings/'
export const BASE_URL = 'https://alphawave.wd10.myworkdayjobs.com/Alphawave_External?locations=d9b1a3a6e54d1008421b5a4934ad0000&locations=f3ca14c95ae81010b95985e62beb0000'
export const SOURCE = 'alphawavesemiindia'
export const COMPANY_NAME = 'Alphawave Semi India'

const scraperDir = path.dirname(fileURLToPath(import.meta.url))

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: BASE_URL,
  locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
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

