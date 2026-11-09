import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { JIOSAAVN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = JIOSAAVN_CATALOG.source
export const COMPANY = JIOSAAVN_CATALOG.companyName
export const HOMEPAGE_URL = JIOSAAVN_CATALOG.homepageUrl
export const CAREERS_URL = JIOSAAVN_CATALOG.companyCareerPage
export const COUNTRY_FILTER = JIOSAAVN_CATALOG.countryFilter
export const VERIFIED_ON = JIOSAAVN_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = JIOSAAVN_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = JIOSAAVN_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EXPECTED_LOCATION_LABELS = [
  'Mumbai',
  'Bengaluru',
  'Gurgaon',
  'New York City',
  'Mountain View, CA',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjob title\b/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return /Work With Us/i.test(normalized)
    && /Come make music beautiful/i.test(normalized)
    && /Find (?:Authentic Jobs|Your Dream Job)/i.test(normalized)
    && /Life At JioSaavn/i.test(normalized)
    && /Find Your Gig/i.test(normalized)
    && /Saavn Media Limited/i.test(normalized)
}

export const extractLocationOpeningCounts = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return EXPECTED_LOCATION_LABELS.flatMap((location) => {
    const match = normalized.match(new RegExp(`${escapeRegExp(location)}\\s+(\\d+)\\s+Openings?`, 'i'))
    if (!match) return []

    return [{
      location,
      openings: Number.parseInt(match[1], 10),
    }]
  })
}

export const hasVerifiedZeroOpeningsSignal = (html) => {
  const counts = extractLocationOpeningCounts(html)

  return hasOfficialCareersSignal(html)
    && counts.length === EXPECTED_LOCATION_LABELS.length
    && counts.every((item) => item.openings === 0)
}

export const pageExposesPublicJobListings = (html) => {
  const rawHtml = String(html ?? '')
  if (extractLocationOpeningCounts(rawHtml).some((item) => item.openings > 0)) return true
  if (hasVerifiedZeroOpeningsSignal(rawHtml)) return false
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(rawHtml))
}

export const createJioSaavnScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('JioSaavn careers page no longer matches the verified first-party public surface')
    }

    if (pageExposesPublicJobListings(careersHtml) || !hasVerifiedZeroOpeningsSignal(careersHtml)) {
      throw new Error('JioSaavn public jobs surface now exposes openings or changed shape')
    }

    return []
  },
})

export const run = async (options = {}) => createJioSaavnScraper().run(options)

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
