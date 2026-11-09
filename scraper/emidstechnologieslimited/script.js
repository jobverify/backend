import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import EMIDS_TECHNOLOGIES_LIMITED_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EMIDS_TECHNOLOGIES_LIMITED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_JOBS_BOARD_URL = PROVIDER_METADATA.officialJobsBoardUrl
export const LISTING_API_BASE_URL = PROVIDER_METADATA.listingApiBaseUrl
export const DETAIL_API_BASE_URL = PROVIDER_METADATA.detailApiBaseUrl
export const PUBLIC_JOBS_BASE_URL = PROVIDER_METADATA.publicJobsBaseUrl
export const TENANT_CODE = PROVIDER_METADATA.tenantCode
export const PUBLIC_API_KEY = PROVIDER_METADATA.publicApiKey
export const CANDIDATE_EXPERIENCE_URL = PROVIDER_METADATA.oracleCandidateExperienceUrl
export const ORACLE_LISTING_API_BASE_URL = PROVIDER_METADATA.oracleListingApiBaseUrl
export const ORACLE_DETAIL_API_BASE_URL = PROVIDER_METADATA.oracleDetailApiBaseUrl
export const ORACLE_PUBLIC_JOBS_BASE_URL = PROVIDER_METADATA.oraclePublicJobsBaseUrl
export const SITE_NUMBER = PROVIDER_METADATA.siteNumber

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&#x27;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const defaultFetchText = (url, { headers = {} } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ...headers,
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, { headers = {} } = {}) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...headers,
  },
  label: SOURCE,
  timeoutMs: 30000,
})

const normalizeAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? '')).href
  } catch {
    return null
  }
}

const getListingSummary = (payload = {}) => payload?.items?.[0] || {}

const getRequisitionList = (payload = {}) => {
  const summary = getListingSummary(payload)
  return Array.isArray(summary?.requisitionList) ? summary.requisitionList : []
}

const getDetailRecord = (payload = {}) => payload?.items?.[0] || {}

const normalizeLocation = (value) => normalizeWhitespace(value)

const normalizeLocationList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((location) => normalizeWhitespace(location))
      .filter(Boolean)
  }

  const singleValue = normalizeWhitespace(value)
  return singleValue ? [singleValue] : []
}

const joinLocations = (locations = [], country = null) => {
  const normalizedLocations = normalizeLocationList(locations)
  if (normalizedLocations.length > 0) {
    return normalizeWhitespace(normalizedLocations.join(' / '))
  }

  return normalizeWhitespace(country)
}

const inferCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const isIndiaJob = (item = {}) => {
  const primaryCountry = normalizeWhitespace(item?.PrimaryLocationCountry)?.toUpperCase()
  const primaryLocation = normalizeWhitespace(item?.PrimaryLocation)
  const secondaryLocations = Array.isArray(item?.secondaryLocations)
    ? item.secondaryLocations
      .map((location) => normalizeWhitespace(location?.Name))
      .filter(Boolean)
    : []

  return primaryCountry === 'IN'
    || /(?:^|,)\s*india\s*$/i.test(primaryLocation || '')
    || secondaryLocations.some((location) => /(?:^|,)\s*india\s*$/i.test(location))
}

const getEmploymentType = (item = {}) =>
  normalizeWhitespace(
    item.RequisitionType
      || item.JobType
      || item.WorkerType
      || item.JobSchedule,
  )

const toListing = (item = {}) => {
  const jobId = normalizeWhitespace(item?.Id)
  const location = normalizeLocation(
    item?.PrimaryLocation
      || item?.secondaryLocations?.[0]?.Name,
  )

  if (!jobId) return null

  return {
    title: normalizeWhitespace(item?.Title),
    company: COMPANY,
    department: normalizeWhitespace(item?.JobFunction || item?.Department || item?.Category) || null,
    location,
    city: inferCity(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: `${PUBLIC_JOBS_BASE_URL}${jobId}`,
    applyUrl: `${PUBLIC_JOBS_BASE_URL}${jobId}`,
    employmentType: getEmploymentType(item),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(item?.ExternalPostedStartDate || item?.PostedDate),
    closingDate: normalizeDate(item?.ExternalPostedEndDate || item?.PostingEndDate),
    jobDescription: normalizeWhitespace(item?.ShortDescriptionStr) || null,
    remoteStatus: null,
  }
}

export const hasOfficialCorporateCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title[^>]*>\s*Careers\s*-\s*Emids\s*<\/title>/i.test(page)
    && text.includes('Help Shape the Future of Health')
    && text.includes('Be A Part Of Our Growth Story')
    && text.includes('Explore Open Roles')
}

export const extractCorporateHandoffUrl = (html = '') =>
  normalizeAbsoluteUrl(
    String(html ?? '').match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Explore Open Roles\s*<\/a>/i)?.[1],
  )

export const hasOfficialCandidateExperienceSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Emids Career Site\s*<\/title>/i.test(page)
    && /<base[^>]+href=["']\/hcmUI\/CandidateExperience\/en\/sites\/CX_1\/?["'][^>]+data-apibaseurl=["']https:\/\/fa-eupt-saasfaprod1\.fa\.ocs\.oraclecloud\.com:443["'][^>]+data-sitenumber=["']CX_1["']/i.test(page)
}

export const hasOfficialBibhaCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Careers\s*\|\s*<\/title>/i.test(page)
    && page.includes('/_next/static/chunks/app/career/%5BtenantCode%5D/page-')
}

export const buildSearchUrl = ({ page = 0, limit = 5, location = 'India' } = {}) => {
  const normalizedLimit = Number(limit) || 5
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit
  return `${ORACLE_LISTING_API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${normalizedLimit},offset=${offset},location=${location}`
}

export const buildJobDetailApiUrl = (jobId) =>
  `${ORACLE_DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

export const buildBibhaJobsApiUrl = ({
  page = 1,
  limit = 10,
  search = '',
  category = '',
  location = '',
} = {}) => {
  const params = new URLSearchParams({
    tenantCode: TENANT_CODE,
    page: String(Math.max(1, Number(page) || 1)),
    limit: String(Math.max(1, Number(limit) || 10)),
  })

  if (normalizeWhitespace(search)) params.set('search', normalizeWhitespace(search))
  if (normalizeWhitespace(category)) params.set('category', normalizeWhitespace(category))
  if (normalizeWhitespace(location)) params.set('location', normalizeWhitespace(location))

  return `${LISTING_API_BASE_URL}?${params.toString()}`
}

export const buildBibhaJobDetailApiUrl = (jobId) => {
  const params = new URLSearchParams({
    tenantCode: TENANT_CODE,
    jobId: normalizeWhitespace(jobId) || '',
  })

  return `${DETAIL_API_BASE_URL}?${params.toString()}`
}

export const buildBibhaApplyUrl = (jobId) =>
  `${PUBLIC_JOBS_BASE_URL}${normalizeWhitespace(jobId) || ''}/`

export const extractSearchResults = (payload = {}) =>
  getRequisitionList(payload)
    .filter((item) => isIndiaJob(item))
    .map((item) => toListing(item))
    .filter((item) => item?.title && item?.jobId)

export const extractPaginationSummary = (payload = {}, { page = 0 } = {}) => {
  const summary = getListingSummary(payload)
  const pageSize = Number(summary?.Limit) || 5
  const totalCount = Number(summary?.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    nextOffset,
    totalCount,
  }
}

export const hasVerifiedBibhaJobsPayload = (payload = {}) => {
  const jobs = payload?.data?.jobs
  const pagination = payload?.data?.pagination

  return payload?.success === true
    && Array.isArray(jobs)
    && Number.isFinite(Number(pagination?.page))
    && Number.isFinite(Number(pagination?.totalItems))
}

export const hasVerifiedBibhaJobDetailPayload = (payload = {}) =>
  payload?.success === true
  && normalizeWhitespace(payload?.data?.id)
  && normalizeWhitespace(payload?.data?.title)

const isBibhaIndiaJob = (item = {}) => {
  const country = normalizeWhitespace(item?.country)
  const locations = normalizeLocationList(item?.location)

  return /^india$/i.test(country || '')
    || locations.some((location) => /(?:^|,)\s*india\s*$/i.test(location))
}

const toBibhaListing = (item = {}) => {
  const jobId = normalizeWhitespace(item?.id)
  const country = normalizeWhitespace(item?.country) || 'India'
  const location = joinLocations(item?.location, country)
  const primaryLocation = normalizeLocationList(item?.location)[0] || location

  if (!jobId) return null

  return {
    title: normalizeWhitespace(item?.title),
    company: COMPANY,
    department: normalizeWhitespace(item?.category) || null,
    location,
    city: inferCity(primaryLocation),
    country,
    jobId,
    requisitionId: normalizeWhitespace(item?.rrNumber) || jobId,
    sourceUrl: buildBibhaApplyUrl(jobId),
    applyUrl: buildBibhaApplyUrl(jobId),
    employmentType: normalizeWhitespace(item?.employmentType) || null,
    experienceRequired: normalizeWhitespace(item?.experience) || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(item?.postedDate),
    closingDate: null,
    jobDescription: stripTags(item?.description) || null,
    remoteStatus: normalizeWhitespace(item?.workMode) || null,
  }
}

export const extractBibhaSearchResults = (payload = {}) =>
  (Array.isArray(payload?.data?.jobs) ? payload.data.jobs : [])
    .map((item) => ({
      ...item,
      country: normalizeWhitespace(item?.country) || 'India',
    }))
    .filter((item) => isBibhaIndiaJob(item))
    .map((item) => toBibhaListing(item))
    .filter((item) => item?.title && item?.jobId)

export const extractBibhaPaginationSummary = (payload = {}) => {
  const pagination = payload?.data?.pagination || {}

  return {
    hasNext: Boolean(pagination?.hasNext),
    page: Math.max(1, Number(pagination?.page) || 1),
    pageSize: Math.max(1, Number(pagination?.limit) || 10),
    totalCount: Math.max(0, Number(pagination?.totalItems) || 0),
    totalPages: Math.max(0, Number(pagination?.totalPages) || 0),
  }
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detail = getDetailRecord(payload)
  const location = normalizeLocation(detail?.PrimaryLocation || listing.location)
  const jobId = normalizeWhitespace(detail?.Id) || listing.jobId
  const sourceUrl = `${ORACLE_PUBLIC_JOBS_BASE_URL}${jobId}`

  return {
    title: normalizeWhitespace(detail?.Title) || listing.title || null,
    company: COMPANY,
    department: normalizeWhitespace(detail?.JobFunction || detail?.Department || detail?.Category)
      || listing.department
      || null,
    location,
    city: inferCity(location) || listing.city || null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(detail?.ExternalQualificationsStr) || null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(detail?.ExternalPostedStartDate || detail?.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail?.ExternalPostedEndDate || detail?.PostingEndDate) || listing.closingDate || null,
    jobDescription: joinDescriptionParts(
      detail?.ExternalDescriptionStr,
      detail?.ExternalResponsibilitiesStr,
      detail?.ShortDescriptionStr,
    ) || listing.jobDescription || null,
    remoteStatus: null,
  }
}

export const extractBibhaJobDetail = (payload = {}, listing = {}) => {
  const detail = payload?.data || {}
  const country = normalizeWhitespace(detail?.country) || listing.country || 'India'
  const location = joinLocations(detail?.location, country) || listing.location || country
  const primaryLocation = normalizeLocationList(detail?.location)[0] || location
  const jobId = normalizeWhitespace(detail?.id) || listing.jobId
  const applyUrl = buildBibhaApplyUrl(jobId)

  return {
    title: normalizeWhitespace(detail?.title) || listing.title || null,
    company: COMPANY,
    department: normalizeWhitespace(detail?.category) || listing.department || null,
    location,
    city: inferCity(primaryLocation) || listing.city || null,
    country,
    jobId,
    requisitionId: normalizeWhitespace(detail?.rrNumber) || listing.requisitionId || jobId,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: normalizeWhitespace(detail?.employmentType) || listing.employmentType || null,
    experienceRequired: normalizeWhitespace(detail?.experience) || listing.experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(detail?.postedDate) || listing.postingDate || null,
    closingDate: null,
    jobDescription: stripTags(detail?.description) || listing.jobDescription || null,
    remoteStatus: normalizeWhitespace(detail?.workMode) || listing.remoteStatus || null,
  }
}

const fetchBibhaJson = (fetchJson, url) => fetchJson(url, {
  headers: {
    'x-api-key': PUBLIC_API_KEY,
  },
})

const isBibhaHandoffUrl = (value) => {
  const normalizedValue = normalizeAbsoluteUrl(value)
  if (!normalizedValue) return false

  return normalizedValue === OFFICIAL_JOBS_BOARD_URL
    || normalizedValue === `${OFFICIAL_JOBS_BOARD_URL.replace(/\/$/, '')}/`
}

export const createEmidsTechnologiesLimitedScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCorporateCareersSignal(careersHtml)) {
      throw new Error('Emids Technologies Limited verified first-party careers page no longer matches the trusted handoff')
    }

    const handoffUrl = extractCorporateHandoffUrl(careersHtml)

    const jobs = []
    const seenJobIds = new Set()

    if (isBibhaHandoffUrl(handoffUrl)) {
      const bibhaCareersHtml = await fetchText(OFFICIAL_JOBS_BOARD_URL)
      if (!hasOfficialBibhaCareersSignal(bibhaCareersHtml)) {
        throw new Error('Emids Technologies Limited verified Bibha careers shell no longer matches the trusted page')
      }

      for (let page = 1; page <= maxPages; page += 1) {
        const payload = await fetchBibhaJson(fetchJson, buildBibhaJobsApiUrl({ page }))
        if (!hasVerifiedBibhaJobsPayload(payload)) {
          throw new Error('Emids Technologies Limited verified Bibha jobs API no longer matches the trusted payload')
        }

        const listings = extractBibhaSearchResults(payload)
        const summary = extractBibhaPaginationSummary(payload)

        for (const listing of listings) {
          if (seenJobIds.has(listing.jobId)) continue
          seenJobIds.add(listing.jobId)

          const detailPayload = await fetchBibhaJson(fetchJson, buildBibhaJobDetailApiUrl(listing.jobId))
          if (!hasVerifiedBibhaJobDetailPayload(detailPayload)) {
            throw new Error(`Emids Technologies Limited verified Bibha job detail API no longer matches the trusted payload for ${listing.jobId}`)
          }

          const detail = extractBibhaJobDetail(detailPayload, listing)
          if (!isBibhaIndiaJob(detail)) continue

          jobs.push({
            ...detail,
            source: SOURCE,
            link: detail.applyUrl || detail.sourceUrl,
            scrapedAt: now(),
          })

          if (maxJobs && jobs.length >= maxJobs) {
            return jobs
          }
        }

        if (!summary.hasNext) break
      }

      return jobs
    }

    if (handoffUrl && handoffUrl !== CANDIDATE_EXPERIENCE_URL) {
      throw new Error(
        `Emids Technologies Limited careers handoff changed to ${handoffUrl}; update scraper to follow the new public board`,
      )
    }

    const candidateExperienceHtml = await fetchText(CANDIDATE_EXPERIENCE_URL)
    if (!hasOfficialCandidateExperienceSignal(candidateExperienceHtml)) {
      throw new Error('Emids Technologies Limited verified Oracle candidate experience shell no longer matches the trusted page')
    }

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ page }))
      const listings = extractSearchResults(payload)
      const summary = extractPaginationSummary(payload, { page })

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await fetchJson(buildJobDetailApiUrl(listing.jobId))
        const detail = extractJobDetail(detailPayload, listing)

        jobs.push({
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createEmidsTechnologiesLimitedScraper().run(options)

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
