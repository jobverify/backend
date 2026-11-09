import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'
import { SHOPPERS_STOP_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export const PROVIDER_METADATA = SHOPPERS_STOP_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const DARWINBOX_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const DARWINBOX_ORIGIN = PROVIDER_METADATA.darwinboxOrigin
export const DARWINBOX_COMPANY_ID = PROVIDER_METADATA.darwinboxCompanyId

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const extractOfficialDarwinboxUrl = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/https:\/\/ss-people\.darwinbox\.in\/ms\/candidate\/careers/i)?.[0],
)

export const hasOfficialShoppersStopCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const normalized = (normalizeWhitespace(page) || '').toLowerCase()

  return normalized.includes('shoppers stop')
    && normalized.includes('about us')
    && normalized.includes('careers')
    && extractOfficialDarwinboxUrl(page) === DARWINBOX_HANDOFF_URL
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'shoppersstop-official',
  timeoutMs: 15000,
})

export const createShoppersStopScraper = () => {
  const darwinboxScraper = createDarwinboxScraper({
    companyName: COMPANY,
    source: SOURCE,
    companyId: DARWINBOX_COMPANY_ID,
    origin: DARWINBOX_ORIGIN,
  })

  return {
    ...darwinboxScraper,
    async run({
      fetchText = defaultFetchText,
      ...options
    } = {}) {
      const aboutPageHtml = await fetchText(ABOUT_PAGE_URL)

      if (!hasOfficialShoppersStopCareersSignals(aboutPageHtml)) {
        throw new Error(
          'Shoppers Stop verified official about page no longer matches the verified public careers handoff',
        )
      }

      return darwinboxScraper.run(options)
    },
  }
}

const scraper = createShoppersStopScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

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
