import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SUZLON_ENERGY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SUZLON_ENERGY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;|\u00a0/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x27;|&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

const ENUMERABLE_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bbrowse jobs\b/i,
  /\bapply now\b/i,
  /\/in-en\/careers\/job-opportunity\/\d+\//i,
  /\/job-opportunity\/\d+\//i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ats\.rippling\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /darwinbox/i,
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasEnumerablePublicJobsSignal = (html = '') =>
  ENUMERABLE_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes("Careers at Suzlon | Join India's Wind Energy Leader")
    && normalized.includes('Your work can move the world forward')
    && normalized.includes('We are building renewable energy systems designed for the new world.')
    && normalized.includes('Advancing people. Accelerating futures')
    && normalized.includes('Equal opportunities')
    && normalized.includes('Career advancement')
    && normalized.includes("Women's Development")
    && normalized.includes('1Learn')
    && normalized.includes('Sectoral development')
  }

export const createSuzlonEnergyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (hasEnumerablePublicJobsSignal(careersHtml)) {
      throw new Error('Suzlon Energy first-party careers page now exposes enumerable public jobs')
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Suzlon Energy verified first-party careers page no longer matches the trusted surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSuzlonEnergyScraper(options).run(options)

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
