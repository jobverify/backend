import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { shouldContinueWorkdayJobsApiPagination } from '../../scraper-support/myworkday/engine.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import TECHWAVE_CONSULTING_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TECHWAVE_CONSULTING_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOIN_US_URL = PROVIDER_METADATA.joinUsPageUrl
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const PAGE_SIZE = 20
const DETAIL_FETCH_CONCURRENCY = 4
const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'content-type': 'application/json',
  },
  body,
  label: `${SOURCE}-json`,
  timeoutMs: 20000,
})

const isIndiaDescriptor = (value) => /\b(bangalore|gdc financial district|gdc hitech|khammam|india)\b/i.test(
  normalizeWhitespace(value) || '',
)

const buildDetailUrl = (externalPath) => {
  if (!externalPath) return null

  try {
    if (String(externalPath).startsWith('/')) {
      return `${WORKDAY_BOARD_URL}${externalPath}`.split('?')[0]
    }

    return new URL(String(externalPath), `${WORKDAY_BOARD_URL}/`).toString().split('?')[0]
  } catch {
    return null
  }
}

const extractJobId = (posting = {}) => {
  const requisitionId = Array.isArray(posting?.bulletFields)
    ? posting.bulletFields.find((value) => /^[A-Z]{2,}-\d+$/i.test(String(value)))
    : null

  if (requisitionId) return requisitionId

  const externalPath = String(posting?.externalPath ?? '')
  const requisitionFromPath = externalPath.match(/_([A-Z]{2,}-\d+)(?:\/)?$/i)?.[1]
  if (requisitionFromPath) return requisitionFromPath

  const lastSegment = externalPath.split('/').filter(Boolean).at(-1)
  if (!lastSegment) return null

  const cleanedSegment = lastSegment
    .replace(/_+$/g, '')
    .replace(/-+$/g, '')

  return cleanedSegment || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^\d+\s+locations?$/i.test(normalized)) return null
  return normalizeCity(normalized)
}

const normalizePosting = (posting, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const locationLabel = normalizeWhitespace(posting?.locationsText)
  const link = buildDetailUrl(posting?.externalPath)
  const jobId = extractJobId(posting)

  if (!title || !locationLabel || !link || !jobId) {
    throw new Error('Techwave verified jobs payload changed materially')
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location: normalizeLocation(locationLabel),
    city: extractCity(locationLabel),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: link,
    applyUrl: link,
    employmentType: normalizeEmploymentType(posting?.timeType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
    source: SOURCE,
    link,
    scrapedAt,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page.replace(/<[^>]+>/g, ' ')) || ''

  return /<title>\s*Techwave Careers:\s*Empowering Your Success\s*<\/title>/i.test(page)
    && normalized.includes('Work that moves you.')
    && normalized.includes('Explore Opportunities')
    && normalized.includes('View Open Roles')
    && new RegExp(`href=["']${JOIN_US_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(page)
}

export const hasJoinUsWorkdayEmbedSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page.replace(/<[^>]+>/g, ' ')) || ''

  return /<title>\s*Join Us\s*-\s*TechWave\s*<\/title>/i.test(page)
    && normalized.includes('Discover What’s Possible. Join Us.')
    && new RegExp(`<iframe[^>]+src=["']${WORKDAY_BOARD_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(page)
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${WORKDAY_BOARD_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(page)
    && /TechWave_Careers\/assets\/logo/i.test(page)
}

export const buildUnfilteredJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: '',
})

export const extractIndiaLocationFacetIds = (payload = {}) => {
  const locationsFacet = (Array.isArray(payload?.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === 'locationMainGroup')
    ?.values?.find((value) => value?.facetParameter === 'locations')

  if (!locationsFacet || !Array.isArray(locationsFacet.values)) {
    throw new Error('The verified Techwave India Workday facet changed materially')
  }

  return locationsFacet.values
    .filter((value) => isIndiaDescriptor(value?.descriptor))
    .map((value) => normalizeWhitespace(value?.id))
    .filter(Boolean)
}

export const buildIndiaJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
  locationFacetIds = [],
} = {}) => JSON.stringify({
  appliedFacets: {
    locations: locationFacetIds,
  },
  limit,
  offset,
  searchText: '',
})

export const createTechwaveConsultingScraper = ({
  now = () => new Date().toISOString(),
  maxPages = Number.POSITIVE_INFINITY,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Techwave careers shell no longer matches the trusted first-party surface')
    }

    const joinUsHtml = await fetchText(JOIN_US_URL)
    if (!hasJoinUsWorkdayEmbedSignal(joinUsHtml)) {
      throw new Error('The verified Techwave join-us page no longer matches the trusted first-party Workday handoff')
    }

    const boardHtml = await fetchText(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable({ status: 200, html: boardHtml, url: WORKDAY_BOARD_URL }, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (!hasOfficialWorkdayBoardSignal(boardHtml)) {
      throw new Error('The verified Techwave Workday board no longer matches the trusted public surface')
    }

    const unfilteredPayload = await fetchJson(
      JOBS_API_URL,
      buildUnfilteredJobsRequestBody({ offset: 0 }),
    )
    const locationFacetIds = extractIndiaLocationFacetIds(unfilteredPayload)

    if (locationFacetIds.length === 0) {
      return []
    }

    const jobs = []
    const seenJobIds = new Set()
    let offset = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(
        JOBS_API_URL,
        buildIndiaJobsRequestBody({ offset, locationFacetIds }),
      )
      const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []

      if (page === 1 && postings.length === 0) {
        return []
      }

      for (const posting of postings) {
        const job = normalizePosting(posting, now())
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      offset += postings.length
      if (!shouldContinueWorkdayJobsApiPagination({
        jobsCount: postings.length,
        offsetAfterPage: offset,
        payloadTotal: payload?.total || 0,
        pageSize: PAGE_SIZE,
      })) {
        break
      }
    }

    return mapWithConcurrency(
      jobs,
      DETAIL_FETCH_CONCURRENCY,
      async (job) => {
        try {
          const detailHtml = await fetchText(job.sourceUrl || job.link)
          if (!detailHtml) {
            return job
          }

          const detail = await extractJobDetail({
            provider: 'workday',
            html: detailHtml,
          })

          return {
            ...job,
            department: detail.department || job.department,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
            minimumQualification: detail.minimumQualification || job.minimumQualification,
            preferredQualification: detail.preferredQualification || job.preferredQualification,
            requiredSkills: Array.isArray(detail.requiredSkills) && detail.requiredSkills.length > 0
              ? detail.requiredSkills
              : job.requiredSkills,
            jobDescription: detail.jobDescription || job.jobDescription,
            postingDate: detail.postingDate || job.postingDate,
            requisitionId: detail.requisitionId || job.requisitionId,
          }
        } catch {
          return job
        }
      },
    )
  },
})

export const run = async (options = {}) => createTechwaveConsultingScraper(options).run(options)

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
