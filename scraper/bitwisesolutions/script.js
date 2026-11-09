import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { BITWISE_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BITWISE_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPENINGS_URL = PROVIDER_METADATA.openingsPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const hasOpeningsRouteLink = (html = '') =>
  /href=["'](?:https:\/\/www\.bitwiseglobal\.com)?\/company\/careers\/openings["']/i.test(String(html ?? ''))

const hasJobRecordSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /href=["'][^"']*\/company\/careers\/openings\/[^"']+/i.test(page)
    || normalized.includes('View Job')
    || normalized.includes('Apply Now')
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Careers')
    && normalized.includes('Engineer the systems that power intelligent enterprises')
    && hasOpeningsRouteLink(html)
    && (
      normalized.includes('View Open Positions')
      || normalized.includes('View Opportunities')
    )
}

export const hasNoOpeningsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const hasLegacyZeroState = normalized.includes('No openings found')
    && normalized.includes('Try adjusting your filters or search.')
  const hasCurrentZeroState = normalized.includes('Find your place in the Bitwise family.')
    && normalized.includes('Keep Up with Bitwise News!')

  return normalized.includes('Current Openings')
    && normalized.includes('All Locations')
    && normalized.includes('All Types')
    && (hasLegacyZeroState || hasCurrentZeroState)
    && !hasJobRecordSignal(html)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createBitwiseSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Bitwise Solutions verified careers page no longer matches the trusted first-party contract')
    }

    const openingsHtml = await fetchText(OPENINGS_URL)
    if (!hasNoOpeningsSignal(openingsHtml)) {
      throw new Error('Bitwise Solutions current openings page no longer matches the verified zero-openings contract')
    }

    return []
  },
})

export const run = async (options = {}) => createBitwiseSolutionsScraper().run(options)

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
