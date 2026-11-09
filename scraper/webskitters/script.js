import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { WEBSKITTERS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialEmptyStateSignal = (html = '') => {
  const page = String(html ?? '')

  return page.includes('var WpjbData')
    && page.includes('No job listings found')
    && page.includes('wpjb-job-list wpjb-grid')
    && page.includes('wpjobboard/xml/rss/?filter=active')
}

export const hasPublicJobsSignal = (html = '') => /wpjb-job-list/i.test(String(html ?? ''))
  && !/No job listings found/i.test(String(html ?? ''))

export const createWebskittersScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (hasPublicJobsSignal(careersHtml)) {
      throw new Error('Webskitters surface now appears to expose public jobs')
    }

    if (!hasOfficialEmptyStateSignal(careersHtml)) {
      throw new Error('Webskitters verified first-party careers page no longer matches the trusted empty-state surface')
    }

    return []
  },
})

export const run = async (options = {}) => createWebskittersScraper().run(options)

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
