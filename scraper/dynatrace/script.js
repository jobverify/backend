import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import DYNATRACE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = DYNATRACE_CATALOG.source
export const COMPANY = DYNATRACE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = DYNATRACE_CATALOG.officialBrandName
export const VERIFIED_ON = DYNATRACE_CATALOG.verifiedOn
export const PROVIDER_METADATA = DYNATRACE_CATALOG
export const ALL_JOBS_URL = DYNATRACE_CATALOG.companyCareerPage
export const LOCATIONS_OVERVIEW_URL = DYNATRACE_CATALOG.locationsOverviewUrl
export const BENGALURU_LOCATION_URL = DYNATRACE_CATALOG.bengaluruLocationUrl
export const MUMBAI_LOCATION_URL = DYNATRACE_CATALOG.mumbaiLocationUrl
export const OFFICIAL_OFFICE_LOCATIONS_URL = DYNATRACE_CATALOG.officialOfficeLocationsUrl
export const INDIA_LEGAL_ENTITY = DYNATRACE_CATALOG.officialIndiaLegalEntity

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = (url, { signal } = {}) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 20000,
    signal,
  })

const getOpenPositionCount = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const match = normalized.match(/\b(\d+)\s+open positions\b/i)
  if (match) {
    return Number.parseInt(match[1], 10)
  }

  if (/no open roles right now/i.test(normalized)) {
    return 0
  }

  return null
}

export const hasAllJobsPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('All Dynatrace jobs')
    && /dynatrace careers/i.test(normalized)
}

export const hasZeroOpenPositions = (html = '') => getOpenPositionCount(html) === 0

export const hasIndiaLocationCounts = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return /India Bengaluru (?:\d+\s+job(?:s)?|No current jobs)/i.test(normalized)
    && /India Mumbai (?:\d+\s+job(?:s)?|No current jobs)/i.test(normalized)
}

export const hasIndiaLegalEntity = (html = '') =>
  normalizeWhitespace(html).includes(INDIA_LEGAL_ENTITY)

export const hasLocationPageSignal = (html = '', city) => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes(`Careers in ${city}`)
    && normalized.includes('Explore all jobs')
    && hasIndiaLegalEntity(normalized)
}

export const hasNoOpenRolesMessage = (html = '') =>
  /no open roles right now/i.test(normalizeWhitespace(html))
  || (
    normalizeWhitespace(html).includes('Explore all jobs')
    && hasIndiaLegalEntity(html)
    && !/apply now/i.test(normalizeWhitespace(html))
  )

export const hasOfficeLocationsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Dynatrace office locations')
    && normalized.includes(INDIA_LEGAL_ENTITY)
    && /Mumbai, Maharashtra, 400051/i.test(normalized)
    && /Bengaluru \(Bangalore\), Karnataka, 560048/i.test(normalized)
}

export const createDynatraceScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    signal,
  } = {}) {
    const [
      allJobsHtml,
      locationsOverviewHtml,
      bengaluruHtml,
      mumbaiHtml,
    ] = await Promise.all([
      fetchText(ALL_JOBS_URL, { signal }),
      fetchText(LOCATIONS_OVERVIEW_URL, { signal }),
      fetchText(BENGALURU_LOCATION_URL, { signal }),
      fetchText(MUMBAI_LOCATION_URL, { signal }),
    ])

    if (!hasAllJobsPageSignal(allJobsHtml)) {
      throw new Error('Verified Dynatrace all-jobs page changed materially')
    }

    if (!hasIndiaLocationCounts(locationsOverviewHtml)) {
      throw new Error('Verified Dynatrace locations overview changed materially')
    }

    if (!hasLocationPageSignal(bengaluruHtml, 'Bengaluru')) {
      throw new Error('Verified Dynatrace Bengaluru page changed materially')
    }

    if (!hasLocationPageSignal(mumbaiHtml, 'Mumbai')) {
      throw new Error('Verified Dynatrace Mumbai page changed materially')
    }

    if (!hasZeroOpenPositions(allJobsHtml)) {
      throw new Error('Verified Dynatrace all-jobs empty-state changed materially')
    }

    if (!hasNoOpenRolesMessage(bengaluruHtml) || !hasNoOpenRolesMessage(mumbaiHtml)) {
      throw new Error('Verified Dynatrace India location empty-state changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createDynatraceScraper().run(options)

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
