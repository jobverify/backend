import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchWorkdayJobsApiPage,
} from '../../scraper-support/myworkday/engine.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import MANHATTEN_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const PAGE_SIZE = 20
const STABLE_JOB_ID_PATTERN = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/

export const PROVIDER_METADATA = MANHATTEN_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.officialBrandName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_SEARCH_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const WORKDAY_JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const WORKDAY_DETAIL_URL_BASE = 'https://manh.wd5.myworkdayjobs.com/en-US/External'

const GROUPED_LOCATION_PATTERN = /^(?:\d+\s+locations?|multiple locations|various locations)$/i
const INDIA_LOCATION_ALIASES = new Set(
  Object.keys(CANONICAL_CITIES).filter((value) => !/^(?:remote|none)$/i.test(value)),
)

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|\u00a0/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeIndiaCityDescriptor = (value) => {
  let descriptor = normalizeWhitespace(value)
  if (!descriptor) return null

  if (/^(?:india(?: offsite)?|remote\s*-?\s*india)$/i.test(descriptor)) {
    return 'Remote'
  }

  const hasExplicitIndiaMarker = /\bindia\b/i.test(descriptor)
  if (!hasExplicitIndiaMarker && descriptor.includes(',')) return null

  descriptor = descriptor
    .replace(/^India\s*[-:,]\s*/i, '')
    .replace(/\s*,\s*India\s*$/i, '')
    .replace(/\s+\((?:hybrid|remote|on-?site)\)\s*$/i, '')
    .trim()

  if (hasExplicitIndiaMarker && descriptor.includes(',')) {
    descriptor = descriptor.split(',')[0].trim()
  }

  if (!INDIA_LOCATION_ALIASES.has(descriptor.toLowerCase())) return null
  return normalizeCity(descriptor)
}

const getLocationsFacetValues = (payload = {}) => {
  const locationMainGroup = (Array.isArray(payload?.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === 'locationMainGroup')
  const locationsFacet = (Array.isArray(locationMainGroup?.values) ? locationMainGroup.values : [])
    .find((facet) => facet?.facetParameter === 'locations')

  if (!Array.isArray(locationsFacet?.values)) {
    if (Number(payload?.total) === 0) return []
    throw new Error('Manhattan Associates Workday locations facet changed materially')
  }

  return locationsFacet.values
}

export const extractIndiaLocationFacetIds = (payload = {}) => [
  ...new Set(
    getLocationsFacetValues(payload)
      .filter((value) => normalizeIndiaCityDescriptor(value?.descriptor) !== null)
      .map((value) => normalizeWhitespace(value?.id))
      .filter(Boolean),
  ),
]

const extractBulletJobId = (posting = {}) => (
  (Array.isArray(posting?.bulletFields) ? posting.bulletFields : [])
    .map((value) => normalizeWhitespace(value))
    .find(Boolean) || null
)

const extractPathJobId = (posting = {}) => (
  normalizeWhitespace(posting?.externalPath)?.match(/_([^/]+)$/)?.[1] || null
)

const extractJobId = (posting = {}) => {
  const bulletId = extractBulletJobId(posting)
  if (bulletId) return bulletId
  return extractPathJobId(posting)?.replace(/-\d+$/, '') || null
}

const hasConsistentJobIdentity = (posting = {}) => {
  const bulletId = extractBulletJobId(posting)
  const pathId = extractPathJobId(posting)
  if (!bulletId || !pathId) return true
  return pathId === bulletId
    || pathId.startsWith(`${bulletId}-`) && /^\d+$/.test(pathId.slice(bulletId.length + 1))
}

const requireJobPostingsArray = (payload) => {
  if (!Array.isArray(payload?.jobPostings)) {
    throw new Error('Manhattan Associates Workday jobPostings must be an array')
  }

  return payload.jobPostings
}

const buildPageSignature = (postings) => JSON.stringify(
  postings
    .map((posting, index) => (
      normalizeWhitespace(posting?.externalPath)
      || extractJobId(posting)
      || `${normalizeWhitespace(posting?.title) || 'unknown'}:${index}`
    ))
    .sort(),
)

const buildDetailUrl = (externalPath) => {
  const normalizedPath = normalizeWhitespace(externalPath)
  if (!normalizedPath?.startsWith('/job/')) return null

  try {
    return new URL(`${WORKDAY_DETAIL_URL_BASE}${normalizedPath}`).toString()
  } catch {
    return null
  }
}

const validateWorkdayPosting = (posting) => {
  const title = normalizeWhitespace(posting?.title)
  if (!title) {
    throw new Error('Manhattan Associates Workday posting title is required')
  }

  const jobId = extractJobId(posting)
  if (!jobId || !STABLE_JOB_ID_PATTERN.test(jobId)) {
    throw new Error('Manhattan Associates Workday posting requires a stable job id')
  }

  const externalPath = normalizeWhitespace(posting?.externalPath)
  if (!externalPath?.startsWith('/job/')) {
    throw new Error('Manhattan Associates Workday posting externalPath must start with /job/')
  }
  if (!hasConsistentJobIdentity(posting)) {
    throw new Error('Manhattan Associates Workday posting bullet ID contradicts its detail URL identity')
  }

  const location = normalizeWhitespace(posting?.locationsText)
  if (!location) {
    throw new Error('Manhattan Associates Workday posting location is required')
  }

  const link = buildDetailUrl(externalPath)
  if (!link) {
    throw new Error('Manhattan Associates Workday posting externalPath must start with /job/')
  }

  return { title, jobId, externalPath, location, link }
}

const isIndiaPosting = (posting = {}) => {
  const location = normalizeWhitespace(posting?.locationsText)
  const pathLocation = normalizeWhitespace(posting?.externalPath)?.match(/^\/job\/([^/]+)\//i)?.[1]
  const normalizedPathLocation = pathLocation?.replace(/-/g, ' ')
  return Boolean(
    location
    && (
      normalizeIndiaCityDescriptor(location) !== null
      || GROUPED_LOCATION_PATTERN.test(location) && (
        /^IND-/i.test(pathLocation)
        || /\bindia\b/i.test(pathLocation)
        || normalizeIndiaCityDescriptor(normalizedPathLocation) !== null
      )
    ),
  )
}

const normalizeIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location || GROUPED_LOCATION_PATTERN.test(location)) return 'India'
  return /\bindia\b/i.test(location) ? location : `${location}, India`
}

const extractCity = (value) => {
  const location = normalizeWhitespace(value)
  if (!location || GROUPED_LOCATION_PATTERN.test(location)) return null
  return normalizeCity(location.replace(/\s*,?\s*India$/i, '').trim())
}

const mapWorkdayPosting = (posting, { scrapedAt }) => {
  const validated = validateWorkdayPosting(posting)
  if (!isIndiaPosting(posting)) return null

  const { title, jobId, link, location: summaryLocation } = validated

  const location = normalizeIndiaLocation(summaryLocation)

  return {
    jobId,
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractCity(summaryLocation),
    locations: [summaryLocation],
    country: 'India',
    link,
    sourceUrl: link,
    applyUrl: `${link}/apply`,
    source: SOURCE,
    postingDate: null,
    closingDate: null,
    employmentType: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    experienceRequired: null,
    requisitionId: jobId,
    remoteStatus: null,
    companyCareerPage: CAREERS_PAGE_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    scrapedAt,
  }
}

export const extractWorkdayJobs = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => requireJobPostingsArray(payload)
  .map((posting) => mapWorkdayPosting(posting, { scrapedAt }))
  .filter(Boolean)

export const buildJobsPageRequest = ({
  appliedFacets = {},
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => ({
  jobsApiUrl: WORKDAY_JOBS_API_URL,
  bootstrapUrl: WORKDAY_SEARCH_URL,
  appliedFacets,
  offset,
  limit,
  searchText: '',
  source: SOURCE,
})

export const createManhattenScraper = ({
  now = () => new Date().toISOString(),
  pageSize = PAGE_SIZE,
  maxPages = 1000,
} = {}) => {
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error('Manhattan Associates maxPages must be a positive integer')
  }
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('Manhattan Associates pageSize must be a positive integer')
  }

  return {
    async run({ fetchJobsPage = fetchWorkdayJobsApiPage } = {}) {
    const facetPayload = await fetchJobsPage(buildJobsPageRequest({ limit: pageSize }))
    requireJobPostingsArray(facetPayload)
    const locationFacetIds = extractIndiaLocationFacetIds(facetPayload)
    if (locationFacetIds.length === 0) return []

    const scrapedAt = now()
    const jobs = []
    const seenJobIds = new Set()
    const seenPageSignatures = new Set()
    let declaredTotal = null
    let offset = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJobsPage(buildJobsPageRequest({
        appliedFacets: { locations: locationFacetIds },
        offset,
        limit: pageSize,
      }))
      const postings = requireJobPostingsArray(payload)
      const payloadTotal = Number(payload?.total)
      if (!Number.isInteger(payloadTotal) || payloadTotal < 0) {
        throw new Error('Manhattan Associates Workday returned an invalid total')
      }
      if (declaredTotal != null && declaredTotal !== payloadTotal) {
        throw new Error('Manhattan Associates Workday total changed during pagination')
      }
      declaredTotal = payloadTotal
      const pageSignature = buildPageSignature(postings)

      if (postings.length > 0 && seenPageSignatures.has(pageSignature)) {
        throw new Error(`Manhattan Associates repeated Workday page at offset ${offset}`)
      }
      if (postings.length > 0) {
        seenPageSignatures.add(pageSignature)
      }

      const uniqueBeforePage = seenJobIds.size
      const pageJobs = extractWorkdayJobs(payload, { scrapedAt })
      if (pageJobs.length !== postings.length) {
        throw new Error('Manhattan Associates India-filtered Workday page returned a foreign or ambiguous location')
      }
      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      offset += postings.length
      if (seenJobIds.size > declaredTotal) {
        throw new Error('Manhattan Associates Workday returned more unique jobs than its declared total')
      }
      if (postings.length === 0) {
        if (seenJobIds.size < declaredTotal) {
          throw new Error(`Manhattan Associates Workday ended before its declared total at offset ${offset}`)
        }
        break
      }
      if (seenJobIds.size === declaredTotal) break
      if (seenJobIds.size === uniqueBeforePage) {
        throw new Error(`Manhattan Associates Workday made no unique pagination progress at offset ${offset}`)
      }
      if (postings.length < pageSize) {
        throw new Error('Manhattan Associates Workday returned a premature short page below its declared total')
      }
      if (page === maxPages) {
        throw new Error(
          'Manhattan Associates maxPages exhausted while Workday reports more results',
        )
      }
    }

    return jobs.sort((left, right) => (
      left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId)
    ))
    },
  }
}

export const run = async (options = {}) => createManhattenScraper(options).run(options)

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
