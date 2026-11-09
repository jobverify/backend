import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchWorkdayJobsApiPage,
} from '../../scraper-support/myworkday/engine.js'
import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import BLACKLINE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const PAGE_SIZE = 20
const STABLE_JOB_ID_PATTERN = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = BLACKLINE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_SEARCH_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const WORKDAY_JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const WORKDAY_DETAIL_URL_BASE = PROVIDER_METADATA.officialWorkdayBoardUrl

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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const mapWithConcurrency = async (items, limit, iteratee) => {
  const concurrency = Math.max(1, Number.isInteger(limit) ? limit : 1)
  const results = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
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
    throw new Error('BlackLine Workday locations facet changed materially')
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
    throw new Error('BlackLine Workday jobPostings must be an array')
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
    return new URL(`${WORKDAY_DETAIL_URL_BASE.replace(/\/$/, '')}${normalizedPath}`).toString()
  } catch {
    return null
  }
}

const validateWorkdayPosting = (posting) => {
  const title = normalizeWhitespace(posting?.title)
  if (!title) {
    throw new Error('BlackLine Workday posting title is required')
  }

  const jobId = extractJobId(posting)
  if (!jobId || !STABLE_JOB_ID_PATTERN.test(jobId)) {
    throw new Error('BlackLine Workday posting requires a stable job id')
  }

  const externalPath = normalizeWhitespace(posting?.externalPath)
  if (!externalPath?.startsWith('/job/')) {
    throw new Error('BlackLine Workday posting externalPath must start with /job/')
  }
  if (!hasConsistentJobIdentity(posting)) {
    throw new Error('BlackLine Workday posting bullet ID contradicts its detail URL identity')
  }

  const location = normalizeWhitespace(posting?.locationsText)
  if (!location) {
    throw new Error('BlackLine Workday posting location is required')
  }

  const link = buildDetailUrl(externalPath)
  if (!link) {
    throw new Error('BlackLine Workday posting externalPath must start with /job/')
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

const normalizePaginationTotal = ({
  previousTotal,
  payloadTotal,
  postingsCount,
}) => {
  if (!Number.isInteger(payloadTotal) || payloadTotal < 0) {
    throw new Error('BlackLine Workday returned an invalid total')
  }

  if (previousTotal == null) return payloadTotal
  if (payloadTotal === previousTotal) return previousTotal

  // BlackLine's filtered Workday API can report `total: 0` on the trailing
  // page while still returning the final India posting.
  if (payloadTotal === 0 && postingsCount > 0) {
    return previousTotal
  }

  throw new Error('BlackLine Workday total changed during pagination')
}

export const createBlackLineScraper = ({
  now = () => new Date().toISOString(),
  pageSize = PAGE_SIZE,
  maxPages = 1000,
} = {}) => {
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error('BlackLine maxPages must be a positive integer')
  }
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('BlackLine pageSize must be a positive integer')
  }

  return {
    async run({
      fetchJobsPage = fetchWorkdayJobsApiPage,
      fetchPage = defaultFetchPage,
    } = {}) {
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
      declaredTotal = normalizePaginationTotal({
        previousTotal: declaredTotal,
        payloadTotal: Number(payload?.total),
        postingsCount: postings.length,
      })
      const pageSignature = buildPageSignature(postings)

      if (postings.length > 0 && seenPageSignatures.has(pageSignature)) {
        throw new Error(`BlackLine repeated Workday page at offset ${offset}`)
      }
      if (postings.length > 0) {
        seenPageSignatures.add(pageSignature)
      }

      const uniqueBeforePage = seenJobIds.size
      const pageJobs = extractWorkdayJobs(payload, { scrapedAt })
      if (pageJobs.length !== postings.length) {
        throw new Error('BlackLine India-filtered Workday page returned a foreign or ambiguous location')
      }
      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      offset += postings.length
      if (seenJobIds.size > declaredTotal) {
        throw new Error('BlackLine Workday returned more unique jobs than its declared total')
      }
      if (postings.length === 0) {
        if (seenJobIds.size < declaredTotal) {
          throw new Error(`BlackLine Workday ended before its declared total at offset ${offset}`)
        }
        break
      }
      if (seenJobIds.size === declaredTotal) break
      if (seenJobIds.size === uniqueBeforePage) {
        throw new Error(`BlackLine Workday made no unique pagination progress at offset ${offset}`)
      }
      if (postings.length < pageSize) {
        throw new Error('BlackLine Workday returned a premature short page below its declared total')
      }
      if (page === maxPages) {
        throw new Error('BlackLine maxPages exhausted while Workday reports more results')
      }
    }

    const enrichedJobs = await mapWithConcurrency(
      jobs,
      6,
      async (job) => {
        try {
          const detailPage = await fetchPage(job.sourceUrl)
          if (Number(detailPage?.status) !== 200 || !detailPage?.html) {
            return job
          }

          const detail = await extractJobDetail({
            provider: 'workday',
            html: detailPage.html,
          })

          return {
            ...job,
            department: detail.department || job.department,
            requisitionId: detail.requisitionId || job.requisitionId,
            postingDate: detail.postingDate || job.postingDate,
            jobDescription: detail.jobDescription || job.jobDescription,
            minimumQualification: detail.minimumQualification || job.minimumQualification,
            preferredQualification: detail.preferredQualification || job.preferredQualification,
            requiredSkills: Array.isArray(detail.requiredSkills) && detail.requiredSkills.length > 0
              ? detail.requiredSkills
              : job.requiredSkills,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
          }
        } catch {
          return job
        }
      },
    )

    return enrichedJobs.sort((left, right) => (
      left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId)
    ))
    },
  }
}

export const run = async (options = {}) => createBlackLineScraper(options).run(options)

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
