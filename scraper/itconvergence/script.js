import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { IT_CONVERGENCE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview jobs\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjobs\.lever\.co\b/i,
  /\bboards\.greenhouse\.io\b/i,
  /\bjob-boards\.greenhouse\.io\b/i,
  /\bashbyhq\.com\b/i,
  /\bmyworkdayjobs\b/i,
  /\bworkdayjobs\b/i,
  /\bsmartrecruiters\b/i,
  /\bjobvite\b/i,
  /\bsuccessfactors\b/i,
  /\boraclecloud\b/i,
  /\bdarwinbox\b/i,
  /\bicims\b/i,
  /\btaleo\b/i,
  /\bpeoplestrong\b/i,
]

export const PROVIDER_METADATA = IT_CONVERGENCE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl

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

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers - IT Convergence\s*<\/title>/i.test(page)
    && /\bWhy IT Convergence\b/i.test(text)
    && /\bLife at IT Convergence\b/i.test(text)
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createItConvergenceScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (pageExposesPublicJobListings(careersHtml)) {
      throw new Error('IT Convergence careers page now appears to expose a public jobs surface')
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('IT Convergence verified IT Convergence careers page no longer matches the known first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createItConvergenceScraper(options).run(options)

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
