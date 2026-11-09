import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import MAGNIT_GLOBAL_CATALOG from './catalog.js'
import { createMagnitNativeInventory } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MAGNIT_GLOBAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LEGACY_CAREERS_URL = PROVIDER_METADATA.legacyCareerPageUrl
export const DAYFORCE_ORIGIN = 'https://jobs.dayforcehcm.com'
export const DAYFORCE_CLIENT_NAMESPACE = PROVIDER_METADATA.dayforceClientNamespace
export const DAYFORCE_JOB_BOARD_CODE = PROVIDER_METADATA.dayforceJobBoardCode
export const DAYFORCE_JOB_BOARD_ID = PROVIDER_METADATA.dayforceJobBoardId
export const DAYFORCE_LOCALE = PROVIDER_METADATA.dayforceLocale
export const OFFICIAL_DAYFORCE_URL = PROVIDER_METADATA.dayforceBaseUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (normalized) return normalized
  }

  return null
}

const isIndiaLocation = (location = {}) =>
  String(location.isoCountryCode ?? location.countryCode ?? '').toUpperCase() === 'IN'
  || /\bindia\b/i.test(String(location.formattedAddress ?? ''))

export const buildSearchApiUrl = () =>
  `${DAYFORCE_ORIGIN}/api/geo/${DAYFORCE_CLIENT_NAMESPACE}/jobposting/search`

export const buildSearchRequestPayload = (paginationStart = 0, location = 'India') => ({
  clientNamespace: DAYFORCE_CLIENT_NAMESPACE,
  jobBoardCode: DAYFORCE_JOB_BOARD_CODE,
  cultureCode: DAYFORCE_LOCALE,
  distanceUnit: 0,
  paginationStart,
  location,
})

export const buildJobDetailUrl = (jobPostingId) =>
  `${OFFICIAL_DAYFORCE_URL}/jobs/${jobPostingId}`

export const buildCsrfUrl = () => `${DAYFORCE_ORIGIN}/api/auth/csrf`

export const normalizeDayforceBaseUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized.replace(
    /https:\/\/jobs\.dayforcehcm\.com\/en-US\/prounlimited\/CANDIDATEPORTAL/i,
    'https://jobs.dayforcehcm.com/prounlimited/CANDIDATEPORTAL',
  )
}

export const extractOfficialDayforceUrl = (html = '') => {
  const match = String(html).match(
    /https:\/\/jobs\.dayforcehcm\.com\/(?:en-US\/)?prounlimited\/CANDIDATEPORTAL/i,
  )
  return normalizeDayforceBaseUrl(match?.[0])
}

export const hasOfficialMagnitCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*(?:Careers(?:\s*\|\s*Magnit)?)\s*<\/title>/i.test(page)
    && text.includes('India')
    && (text.includes('Learn More') || text.includes('Search Careers'))
    && extractOfficialDayforceUrl(page) === normalizeDayforceBaseUrl(OFFICIAL_DAYFORCE_URL)
}

const extractDayforceBoardPayload = (html = '') => {
  const payload = String(html ?? '').match(
    /<script id=["']__NEXT_DATA__["'] type=["']application\/json["']>([\s\S]*?)<\/script>/i,
  )?.[1]
  if (!payload) return null

  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

export const extractDayforceSiteInfoFromBoardHtml = (html = '') => {
  const dehydratedQueries =
    extractDayforceBoardPayload(html)?.props?.pageProps?.dehydratedState?.queries

  if (!Array.isArray(dehydratedQueries)) return null

  return dehydratedQueries
    .map((query) => query?.state?.data)
    .find((data) => normalizeWhitespace(data?.clientNamespace) && normalizeWhitespace(data?.jobBoardCode))
    || null
}

export const hasVerifiedDayforceSiteContext = (siteInfo = {}) =>
  normalizeWhitespace(siteInfo?.clientNamespace)?.toLowerCase() === DAYFORCE_CLIENT_NAMESPACE
  && normalizeWhitespace(siteInfo?.jobBoardCode)?.toLowerCase() === DAYFORCE_JOB_BOARD_CODE.toLowerCase()
  && normalizeWhitespace(siteInfo?.cultureCode)?.toLowerCase() === DAYFORCE_LOCALE.toLowerCase()
  && Number(siteInfo?.jobBoardId) === DAYFORCE_JOB_BOARD_ID

export const extractSearchPostings = (payload = {}) => {
  if (Array.isArray(payload.jobPostings)) return payload.jobPostings
  if (Array.isArray(payload.postings)) return payload.postings
  return []
}

const getTotalCount = (payload = {}) => {
  const count = payload?.totalCount
    ?? payload?.totalJobCount
    ?? payload?.count
    ?? payload?.maxCount

  return Number.isFinite(count) ? count : Number.parseInt(count, 10) || 0
}

export const normalizeSearchPosting = (posting = {}) => {
  const locations = Array.isArray(posting.postingLocations) ? posting.postingLocations : []
  const indiaLocation = locations.find(isIndiaLocation)
  if (!indiaLocation) return null

  const jobId = posting.jobPostingId
  const title = normalizeWhitespace(posting.jobTitle)
  if (!jobId || !title) return null

  return {
    title,
    company: COMPANY,
    department: null,
    location: firstNonEmpty(
      indiaLocation.formattedAddress,
      [indiaLocation.cityName, indiaLocation.stateCode, indiaLocation.isoCountryCode === 'IN' ? 'India' : null]
        .filter(Boolean)
        .join(', '),
    ),
    city: firstNonEmpty(indiaLocation.cityName, indiaLocation.location),
    country: 'India',
    jobId: String(jobId),
    requisitionId: String(posting.jobReqId ?? jobId),
    sourceUrl: buildJobDetailUrl(jobId),
    applyUrl: buildJobDetailUrl(jobId),
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(posting.postingStartTimestampUTC),
    closingDate: normalizeWhitespace(posting.postingExpiryTimestampUTC),
    jobDescription: stripTags(posting.jobDescription),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  label: options.label || `${SOURCE}-json`,
  timeoutMs: options.timeoutMs || 15000,
})

export const extractCookieHeaderFromResponse = (response) => {
  const headers = response?.headers
  if (!headers) return null

  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : String(headers.get?.('set-cookie') || '')
      .split(/,(?=\s*[^;,=\s]+=[^;]+)/)
      .filter(Boolean)

  const cookieHeader = setCookies
    .map((line) => normalizeWhitespace(String(line).split(';')[0]))
    .filter(Boolean)
    .join('; ')

  return cookieHeader || null
}

export const buildDayforceSessionHeaders = (
  session = {},
  { includeContentType = false } = {},
) => ({
  'User-Agent': USER_AGENT,
  Accept: 'application/json,text/plain,*/*',
  Cookie: session.cookieHeader,
  'X-CSRF-Token': session.csrfToken,
  Referer: OFFICIAL_DAYFORCE_URL,
  Origin: DAYFORCE_ORIGIN,
  ...(includeContentType ? { 'Content-Type': 'application/json;charset=UTF-8' } : {}),
})

export const createDayforceSession = async ({
  fetchJson = defaultFetchJson,
} = {}) => {
  let csrfResponse = null
  const payload = await fetchJson(buildCsrfUrl(), {
    label: `${SOURCE}-dayforce-csrf`,
    fetchImpl: async (url, requestInit) => {
      const response = await fetch(url, requestInit)
      csrfResponse = response
      return response
    },
  })

  const csrfToken = firstNonEmpty(payload?.csrfToken)
  const cookieHeader = extractCookieHeaderFromResponse(csrfResponse)

  if (!csrfToken || !cookieHeader) {
    throw new Error('Magnit Global Dayforce public session bootstrap no longer exposes a CSRF token and cookie contract')
  }

  return {
    csrfToken,
    cookieHeader,
  }
}

export const createMagnitGlobalScraper = (options = {}) => createMagnitNativeInventory(options)

export const run = async (options = {}) => createMagnitGlobalScraper(options).run(options)

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
