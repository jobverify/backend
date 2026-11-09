import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SIMFORM_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /\bjob-card\b/i,
  /\bjob-title-link\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
]

export const PROVIDER_METADATA = SIMFORM_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasVerifiedEmptyState = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Current openings\s*<\/title>/i.test(page)
    && /\bAll Departments\b/i.test(text)
    && /\bAll Locations\b/i.test(text)
    && /\bNo jobs found matching your criteria\b/i.test(text)
    && /\bLoad More Jobs\b/i.test(text)
    && /wp-content\/plugins\/kula-job-board\/scripts\/app\.js/i.test(page)
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createSimformScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)

    if (pageExposesPublicJobListings(currentOpeningsHtml)) {
      throw new Error('Simform current-openings page now appears to expose a public jobs surface')
    }

    if (!hasVerifiedEmptyState(currentOpeningsHtml)) {
      throw new Error('Simform verified Simform current-openings page no longer matches the known empty-state surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSimformScraper(options).run(options)

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
