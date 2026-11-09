import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { NATIONAL_INSTRUMENTS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EMERSON_CAREERS_URL = PROVIDER_METADATA.redirectedCareerPageUrl
export const ORACLE_CANDIDATE_EXPERIENCE_URL = PROVIDER_METADATA.oracleCandidateExperienceUrl
export const ORACLE_ROOT_URL = PROVIDER_METADATA.oracleCandidateExperienceRootUrl
export const WORKSPACE_DOMAIN = PROVIDER_METADATA.workspaceDomain
export const LISTING_API_BASE_URL = PROVIDER_METADATA.listingApiBaseUrl
export const DETAIL_API_BASE_URL = PROVIDER_METADATA.detailApiBaseUrl
export const PUBLIC_JOBS_BASE_URL = PROVIDER_METADATA.publicJobsBaseUrl
export const SITE_NUMBER = PROVIDER_METADATA.siteNumber
export const DEFAULT_LOCATION = PROVIDER_METADATA.countryFilter
export const DEFAULT_LIMIT = 24
export const TARGET_BUSINESS_UNIT_ID = PROVIDER_METADATA.targetBusinessUnitId
export const TARGET_LEGAL_EMPLOYER_ID = PROVIDER_METADATA.targetLegalEmployerId

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^india$/i.test(normalized)) return DEFAULT_LOCATION
  return normalized
}

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const getRequisitionList = (payload = {}) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => Array.isArray(item?.requisitionList) ? item.requisitionList : [])
  }

  if (Array.isArray(payload?.requisitionList)) {
    return payload.requisitionList
  }

  return []
}

const getRequisitionDetail = (payload = {}) => {
  if (Array.isArray(payload?.items) && payload.items[0]) {
    return payload.items[0]
  }

  return payload || {}
}

const getEmploymentType = (record = {}) => normalizeWhitespace(
  record.JobSchedule
    || record.RequisitionType
    || record.JobType
    || record.WorkerType
    || record.ContractType,
)

const getEffectiveLocation = (record = {}) => normalizeLocation(
  record.PrimaryLocation
    || record?.secondaryLocations?.[0]?.Name,
)

const isIndiaJob = (record = {}) => {
  const country = normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase()
  const primaryLocation = normalizeWhitespace(record.PrimaryLocation)
  const secondaryLocations = Array.isArray(record?.secondaryLocations)
    ? record.secondaryLocations
      .map((location) => normalizeWhitespace(location?.Name))
      .filter(Boolean)
    : []

  return (
    country === 'IN'
    || /(?:^|,)\s*india\s*$/i.test(primaryLocation || '')
    || secondaryLocations.some((location) => /(?:^|,)\s*india\s*$/i.test(location))
    || false
  )
}

export const extractOracleCandidateExperienceUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const absoluteUrl = new URL(match[1], EMERSON_CAREERS_URL).toString()
      if (absoluteUrl === ORACLE_CANDIDATE_EXPERIENCE_URL) {
        return absoluteUrl
      }
    } catch {
      // Ignore malformed hrefs.
    }
  }

  return null
}

export const hasOfficialEmersonCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(page) || ''

  return /<title[^>]*>\s*Your Career at Emerson Starts Here\s*<\/title>/i.test(page)
    && normalized.includes("Let's Find Your Role")
    && normalized.includes('Explore All Opportunities')
    && normalized.includes('Life at Emerson')
    && extractOracleCandidateExperienceUrl(page) === ORACLE_CANDIDATE_EXPERIENCE_URL
}

export const hasOfficialNationalInstrumentsRedirectSignal = (page = {}) =>
  Number(page.status) === 200
  && normalizeWhitespace(page.url) === EMERSON_CAREERS_URL
  && hasOfficialEmersonCareersSignal(page.html)

export const hasOfficialCandidateExperienceSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Emerson Career Site\s*<\/title>/i.test(page)
    && new RegExp(
      `<base[^>]+href=["']/hcmUI/CandidateExperience/en/sites/${SITE_NUMBER}/?["'][^>]+data-apibaseurl=["']https://${WORKSPACE_DOMAIN}:443["'][^>]+data-sitenumber=["']${SITE_NUMBER}["']`,
      'i',
    ).test(page)
}

export const matchesNationalInstrumentsBusinessUnit = (record = {}) =>
  normalizeWhitespace(record.BusinessUnitId) === TARGET_BUSINESS_UNIT_ID
  && normalizeWhitespace(record.LegalEmployerId) === TARGET_LEGAL_EMPLOYER_ID

const toListing = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const location = getEffectiveLocation(record)
  const sourceUrl = jobId ? buildJobDetailUrl(jobId) : null

  return {
    title: normalizeWhitespace(record.Title),
    company: COMPANY,
    department: normalizeWhitespace(
      record.JobFunction
        || record.Category
        || record.Department
        || record.BusinessUnit
        || record.Organization,
    ),
    location,
    city: extractCity(location),
    country: DEFAULT_LOCATION,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(record),
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(record.StudyLevel || record.ExternalQualificationsStr),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record.ExternalPostedStartDate || record.PostedDate),
    closingDate: normalizeDate(record.ExternalPostedEndDate || record.PostingEndDate),
    jobDescription: joinDescriptionParts(record.ShortDescriptionStr, record.ExternalDescriptionStr),
    remoteStatus: normalizeWhitespace(record.WorkplaceType) || null,
    siteNumber: SITE_NUMBER,
  }
}

export const buildSearchUrl = ({
  page = 0,
  limit = DEFAULT_LIMIT,
  location = DEFAULT_LOCATION,
} = {}) => {
  const normalizedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit

  return `${LISTING_API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${normalizedLimit},offset=${offset},location=${location}`
}

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

export const buildJobDetailUrl = (jobId) =>
  `${PUBLIC_JOBS_BASE_URL}${normalizeWhitespace(jobId) || ''}`

export const extractSearchResults = (payload = {}) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .filter((record) => matchesNationalInstrumentsBusinessUnit(record))
  .map((record) => toListing(record))
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractPaginationSummary = (payload = {}, { page = 0 } = {}) => {
  const summary = payload?.items?.[0] || {}
  const pageSize = Number(summary.Limit) || DEFAULT_LIMIT
  const totalCount = Number(summary.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    nextOffset,
    totalCount,
  }
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detail = getRequisitionDetail(payload)
  const location = getEffectiveLocation(detail) || listing.location || null
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(jobId)

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: COMPANY,
    department: normalizeWhitespace(
      detail.JobFunction
        || detail.Category
        || detail.Department
        || detail.BusinessUnit
        || detail.Organization,
    ) || listing.department || null,
    location,
    city: extractCity(location) || listing.city || null,
    country: DEFAULT_LOCATION,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(detail.ExternalQualificationsStr || detail.StudyLevel)
      || listing.minimumQualification
      || null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill || skill?.skill || skill?.Name))
        .filter(Boolean)
      : listing.requiredSkills || [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription: joinDescriptionParts(
      detail.ExternalDescriptionStr,
      detail.ShortDescriptionStr,
      detail.ExternalResponsibilitiesStr,
      detail.ExternalQualificationsStr,
    ) || listing.jobDescription || null,
    remoteStatus: normalizeWhitespace(detail.WorkplaceType) || listing.remoteStatus || null,
    siteNumber: SITE_NUMBER,
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(20000) : undefined,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createNationalInstrumentsScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchPage = defaultFetchPage,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    const careersPage = await fetchPage(CAREERS_URL)
    if (!hasOfficialNationalInstrumentsRedirectSignal(careersPage)) {
      throw new Error('National Instruments verified careers redirect no longer matches the pinned Emerson handoff')
    }

    const candidateExperiencePage = await fetchPage(ORACLE_CANDIDATE_EXPERIENCE_URL)
    if (!hasOfficialCandidateExperienceSignal(candidateExperiencePage.html)) {
      throw new Error('National Instruments verified Emerson Oracle candidate experience shell changed materially')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ page }))
      const pageJobs = extractSearchResults(payload)
      const summary = extractPaginationSummary(payload, { page })

      for (const listing of pageJobs) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await fetchJson(buildJobDetailApiUrl(listing.jobId))
        const detailRecord = getRequisitionDetail(detailPayload)
        if (!matchesNationalInstrumentsBusinessUnit(detailRecord)) {
          throw new Error('National Instruments Oracle detail no longer matches the verified Test & Measurement business-unit filter')
        }

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

export const run = async (options = {}) => createNationalInstrumentsScraper(options).run()

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
