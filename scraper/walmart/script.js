import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { WALMART_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_RESULTS_URL = PROVIDER_METADATA.companyCareerPage
export const TECHNOLOGY_URL = PROVIDER_METADATA.technologyCareersPageUrl
export const CORPORATE_URL = PROVIDER_METADATA.corporateCareersPageUrl
export const SEARCH_API_URL = PROVIDER_METADATA.searchApiUrl
export const STRUCTURED_PROBE_QUERY = 'Senior Solution Consultant'
export const INDIA_PROBE_QUERY = 'India'
export const LOCALE = 'en_US'
export const EXPECTED_POPULATIONS = [
  'WALMART_EXT_CAMPUS_US',
  'WALMART_EXT_FIELD_US',
  'SAMS_EXT_CAMPUS_US',
  'SAMS_EXT_FIELD_US',
  'VIZIO_CAMPUS_EXTERNAL',
  'VIZIO_FIELD_EXTERNAL',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATED_TITLE_PATTERN = /^\(IND\)\s*/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasAllExpectedPopulationTokens = (value = '') =>
  EXPECTED_POPULATIONS.every((population) => String(value ?? '').includes(population))

const isExpectedPopulationValue = (value = '') =>
  EXPECTED_POPULATIONS.includes(String(value ?? ''))

const isIndiaCountryCode = (value = '') =>
  String(value ?? '').trim().toUpperCase() === 'IN'

const hasIndiaPopulationToken = (value = '') =>
  /(?:^|_)IN(?:$|_)/i.test(String(value ?? ''))

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
  signal,
})

const defaultSearchJobs = (query, { signal } = {}) => fetchJsonWithRetry(
  `${SEARCH_API_URL}?page=0&size=10&locale=${encodeURIComponent(LOCALE)}`,
  {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Origin: 'https://careers.walmart.com',
      Referer: CAREERS_RESULTS_URL,
    },
    body: JSON.stringify({
      query,
      basicSearch: false,
      filter: '',
      locale: LOCALE,
    }),
    label: SOURCE,
    timeoutMs: 20000,
    signal,
  },
)

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html)

  return /<title\b[^>]*>\s*Walmart Careers\s*<\/title>/i.test(page)
    && normalized.includes('Stores and Clubs')
    && normalized.includes('Supply Chain & Transportation')
    && normalized.includes('Healthcare')
    && normalized.includes('Technology')
    && normalized.includes('Corporate')
    && /\/us\/en\/home\/resources\/location/i.test(page)
}

export const hasTechnologyPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html)

  return /<title\b[^>]*>\s*Technology\s*<\/title>/i.test(page)
    && normalized.includes('See all open roles')
    && normalized.includes('See all technology roles')
    && /\/content\/careers\/us\/en\/results\?searchQuery=All(?:&amp;|&)careerareas=Technology/i.test(page)
    && /\/content\/careers\/us\/en\/results\?searchQuery=Sunnyvale/i.test(page)
    && /\/content\/careers\/us\/en\/results\?searchQuery=Hoboken/i.test(page)
}

export const hasCorporatePageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html)

  return /<title\b[^>]*>\s*Corporate\s*<\/title>/i.test(page)
    && normalized.includes('See all open roles')
    && normalized.includes('See all corporate roles')
    && /\/content\/careers\/us\/en\/results\?searchQuery=All(?:&amp;|&)careerareas=Corporate/i.test(page)
    && /\/content\/careers\/us\/en\/results\?searchQuery=Finance and Accounting(?:&amp;|&)careerareas=Corporate/i.test(page)
    && /\/content\/careers\/us\/en\/results\?searchQuery=Human Resources(?:&amp;|&)careerareas=Corporate/i.test(page)
}

export const hasStructuredSearchProbe = (payload = {}) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : []
  const firstJob = jobs[0]
  const firstMetadata = firstJob?.metadata || {}

  return payload?.jobSearchSucceeded === true
    && Number.isFinite(Number(payload?.totalJobs))
    && Number(payload.totalJobs) > 0
    && jobs.length > 0
    && normalizeWhitespace(firstMetadata.title)
    && normalizeWhitespace(firstMetadata.jobId)
    && normalizeWhitespace(firstMetadata.primaryLocationCountry)
    && normalizeWhitespace(firstMetadata.brand) === 'Walmart'
    && (
      hasAllExpectedPopulationTokens(payload?.jobFilters || '')
      || isExpectedPopulationValue(firstMetadata.population)
    )
}

export const isIndiaLocatedSearchHit = (job = {}) => {
  const metadata = job?.metadata || {}
  const locationText = [
    metadata.primaryLocationCountry,
    metadata.primaryLocationCity,
    metadata.primaryLocationState,
    metadata.primaryLocationStateCode,
    metadata.primaryLocation,
    metadata.location,
    metadata.formattedLocation,
    metadata.country,
    metadata.secondaryLocations,
    metadata.secondaryLocation,
    metadata.additionalLocations,
  ]
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .join(' | ')

  return isIndiaCountryCode(metadata.primaryLocationCountry)
    || hasIndiaPopulationToken(metadata.population)
    || INDIA_LOCATED_TITLE_PATTERN.test(normalizeWhitespace(metadata.title || job?.text || ''))
    || /\bindia\b/i.test(locationText)
}

export const extractIndiaLocatedSearchHits = (payload = {}) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : []
  return jobs.filter((job) => isIndiaLocatedSearchHit(job))
}

export const hasVerifiedIndiaQueryWithoutLocatedHits = (payload = {}) =>
  payload?.jobSearchSucceeded === true
    && Number.isFinite(Number(payload?.totalJobs))
    && Array.isArray(payload?.jobs)
    && extractIndiaLocatedSearchHits(payload).length === 0

export const createWalmartScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    searchJobs = defaultSearchJobs,
    signal,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL, { signal })
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Walmart careers homepage no longer matches the verified first-party surface')
    }

    const technologyHtml = await fetchText(TECHNOLOGY_URL, { signal })
    if (!hasTechnologyPageSignal(technologyHtml)) {
      throw new Error('Walmart technology careers page no longer matches the verified first-party surface')
    }

    const corporateHtml = await fetchText(CORPORATE_URL, { signal })
    if (!hasCorporatePageSignal(corporateHtml)) {
      throw new Error('Walmart corporate careers page no longer matches the verified first-party surface')
    }

    const structuredProbe = await searchJobs(STRUCTURED_PROBE_QUERY, { signal })
    if (!hasStructuredSearchProbe(structuredProbe)) {
      throw new Error('Walmart live search contract no longer matches the verified public results surface')
    }

    const indiaProbe = await searchJobs(INDIA_PROBE_QUERY, { signal })
    const indiaLocatedHits = extractIndiaLocatedSearchHits(indiaProbe)
    if (indiaLocatedHits.length > 0) {
      throw new Error('Walmart public India keyword probe now returns India-located jobs')
    }

    if (!hasVerifiedIndiaQueryWithoutLocatedHits(indiaProbe)) {
      throw new Error('Walmart India keyword probe no longer matches the verified public search contract')
    }

    return []
  },
})

export const run = async (options = {}) => createWalmartScraper().run(options)

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
