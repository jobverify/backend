import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { WEBTEL_ELECTROSOFT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = WEBTEL_ELECTROSOFT_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = String(html).replace(/\s+/g, ' ')

  return normalized.includes('Careers at Webtel: Explore Opportunities & Join Our Dynamic Team')
    && normalized.includes('Be a Part of The Webtel Family!')
    && normalized.includes('Leading Compliance Solutions Company for over 2 Decades')
    && normalized.includes('We Welcome You to Webtel')
    && normalized.includes("Let's Share Equal Opportunities")
}

export const hasPublicJobSignals = (html = '') =>
  /JobPosting|data-job-id=|<article[^>]+itemscope|View Position|Current Openings/i.test(String(html))

export const createWebtelElectrosoftScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html) || hasPublicJobSignals(html)) {
      throw new Error('The verified Webtel careers page no longer matches the trusted marketing-only sentinel')
    }

    return []
  },
})

export const run = async (options = {}) => createWebtelElectrosoftScraper().run(options)

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
