import { runCurrentLexmarkInventory } from './nativeCurrent.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { LEXMARK_INTERNATIONAL_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const WORKDAY_BASE_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const WORKDAY_JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const WORKDAY_DETAIL_EXAMPLE_URL = PROVIDER_METADATA.jobDetailExampleUrl
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const PAGE_SIZE = 20

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value) || null

const normalizeComparableUrl = (value) => String(value ?? '').replace(/\/$/, '')

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (!normalized) return null
  if (normalized === 'full time') return 'Full-Time'
  if (normalized === 'part time') return 'Part-Time'
  return normalizeWhitespace(value) || null
}

const normalizeLocationText = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s{2,}/g, ', ')
  .replace(/\s*,\s*/g, ', ')
  .replace(/\s+/g, ' ')
  .replace(/,\s*,/g, ', ')
  .replace(/^,\s*|\s*,$/g, '')
  .trim()

const ensureIndiaSuffix = (location) => {
  const normalized = normalizeLocationText(location)
  if (!normalized) return 'India'
  if (/\bIndia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (location) => {
  const normalized = normalizeLocationText(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeExternalPath = (value) => {
  try {
    const url = new URL(String(value ?? ''), WORKDAY_BASE_URL)
    const match = url.pathname.match(/\/job\/.+$/i)
    return match?.[0] ?? null
  } catch {
    return null
  }
}

const extractRequisitionId = (jobPosting = {}) =>
  Array.isArray(jobPosting?.bulletFields)
    ? jobPosting.bulletFields
      .map((value) => normalizeWhitespace(value))
      .find((value) => /^R[A-Za-z0-9-]+$/i.test(value))
    : null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const hasLegacyCareersCopy =
    text.includes('Apply Now')
    && text.includes('Lexmark Careers Overview')
    && text.includes('Explore Job Listings')
  const hasCurrentCareersCopy =
    text.includes('Search all jobs')
    && text.includes('Make a Lasting Impression')
    && text.includes('global leader in print hardware, service, solutions and security')

  return /<title[^>]*>\s*Lexmark(?:\s+U\.S\.)?\s+Careers\s*<\/title>/i.test(page)
    && (hasLegacyCareersCopy || hasCurrentCareersCopy)
    && page.includes(WORKDAY_BASE_URL)
}

export const extractVerifiedWorkdayHandoffUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (normalizeComparableUrl(match[1]) === normalizeComparableUrl(WORKDAY_BASE_URL)) {
      return WORKDAY_BASE_URL
    }
  }

  return null
}

export const hasWorkdayBoardBootstrapSignal = (html = '') => {
  const page = String(html ?? '')

  return /<meta[^>]+property=["']og:title["'][^>]+content=["']Lexmark Careers["']/i.test(page)
    && /tenant:\s*"lexmark"/i.test(page)
    && /siteId:\s*"Lexmark"/i.test(page)
    && /<div id="root"><\/div>/i.test(page)
}

export const buildJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: '',
})

export const buildJobDetailApiUrl = (externalPath) => {
  const normalizedPath = normalizeExternalPath(externalPath)
  if (!normalizedPath) return null
  return new URL(`/wday/cxs/lexmark/Lexmark${normalizedPath}`, WORKDAY_BASE_URL).toString()
}

export const buildPublicJobUrl = (externalPath) => {
  const normalizedPath = normalizeExternalPath(externalPath)
  if (!normalizedPath) return null
  return `${WORKDAY_BASE_URL}${normalizedPath}`
}

export const isWorkdayJobsApiPayload = (payload = {}) =>
  Number.isInteger(payload?.total)
  && Array.isArray(payload?.jobPostings)
  && Array.isArray(payload?.facets)
  && payload?.userAuthenticated === false

export const hasWorkdayJobDetailSignal = (payload = {}) => {
  const info = payload?.jobPostingInfo
  return Boolean(
    info
      && normalizeWhitespace(info.title)
      && normalizeWhitespace(info.jobPostingId)
      && normalizeWhitespace(info.jobReqId)
      && normalizeWhitespace(info.location || info?.jobRequisitionLocation?.descriptor),
  )
}

export const isIndiaJobDetail = (payload = {}) => {
  const info = payload?.jobPostingInfo ?? {}
  const alpha2Code = normalizeWhitespace(
    info?.jobRequisitionLocation?.country?.alpha2Code || info?.country?.alpha2Code,
  ).toUpperCase()
  const countryDescriptor = normalizeWhitespace(
    info?.jobRequisitionLocation?.country?.descriptor || info?.country?.descriptor,
  )
  const location = normalizeLocationText(
    info?.jobRequisitionLocation?.descriptor || info?.location,
  )

  return alpha2Code === 'IN'
    || countryDescriptor === 'India'
    || /\bIndia\b/i.test(location)
}

export const mapIndiaJob = (payload = {}, jobPosting = {}) => {
  const info = payload?.jobPostingInfo ?? {}
  const externalPath = normalizeExternalPath(jobPosting.externalPath || info.externalUrl)
  const sourceUrl = normalizeWhitespace(info.externalUrl) || buildPublicJobUrl(externalPath)
  const title = normalizeWhitespace(info.title || jobPosting.title)
  const requisitionId = normalizeWhitespace(info.jobReqId || extractRequisitionId(jobPosting))
  const jobId = normalizeWhitespace(info.jobPostingId || requisitionId || info.id)
  const location = ensureIndiaSuffix(
    info?.jobRequisitionLocation?.descriptor || info?.location || jobPosting.locationsText,
  )

  if (!title || !sourceUrl || !jobId || !location) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId: requisitionId || jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeEmploymentType(info.timeType || jobPosting.timeType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(info.startDate) || null,
    closingDate: normalizeWhitespace(info.endDate) || null,
    jobDescription: stripTags(info.jobDescription),
  }
}

export const createLexmarkInternationalScraper = (defaults = {}) => ({
  run: (options = {}) => runCurrentLexmarkInventory({ ...defaults, ...options }),
})

export const run = async (options = {}) => createLexmarkInternationalScraper(options).run(options)

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
