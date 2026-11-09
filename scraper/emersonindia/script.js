import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { collectOracleRequisitionJobs } from '../../scraper-support/utils/oracleRequisitionInventory.js'
import { readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { EMERSON_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = EMERSON_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const PAGINATION_STRATEGY = PROVIDER_METADATA.paginationStrategy
export const EXTRACTION_STRATEGY = PROVIDER_METADATA.extractionStrategy
export const PARSER = PROVIDER_METADATA.parser
export const NORMALIZATION_PROFILE = PROVIDER_METADATA.normalizationProfile
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CANDIDATE_EXPERIENCE_URL = PROVIDER_METADATA.oracleCandidateExperienceUrl
export const WORKSPACE_DOMAIN = PROVIDER_METADATA.workspaceDomain
export const LISTING_API_BASE_URL = PROVIDER_METADATA.listingApiBaseUrl
export const DETAIL_API_BASE_URL = PROVIDER_METADATA.detailApiBaseUrl
export const PUBLIC_JOBS_BASE_URL = PROVIDER_METADATA.publicJobsBaseUrl
export const SITE_NUMBER = PROVIDER_METADATA.siteNumber
export const DEFAULT_LOCATION = 'India'
export const DEFAULT_LIMIT = 24

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&amp;/gi, '&')

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

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^india$/i.test(normalized)) return COUNTRY_FILTER
  return normalized
}

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

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

const getRequisitionList = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => Array.isArray(item?.requisitionList) ? item.requisitionList : [])
  }

  if (Array.isArray(payload?.requisitionList)) {
    return payload.requisitionList
  }

  return []
}

const getRequisitionDetail = (payload) => {
  if (Array.isArray(payload?.items) && payload.items[0]) {
    return payload.items[0]
  }

  return payload || {}
}

const getEmploymentType = (record = {}) =>
  normalizeWhitespace(
    record.JobSchedule
      || record.RequisitionType
      || record.JobType
      || record.WorkerType
      || record.ContractType,
  )

const getIndiaLocation = (record = {}) => {
  const locations = [{ CountryCode: record.PrimaryLocationCountry, Name: record.PrimaryLocation },
    ...(Array.isArray(record.secondaryLocations) ? record.secondaryLocations : [])]
  const location = locations.find(item => (nativeCountryName(item?.CountryCode)
    || nativeLocationCountryName(item?.Name || item?.LocationName)) === 'India')
  return location ? normalizeWhitespace(location.Name || location.LocationName) || COUNTRY_FILTER : null
}
const isIndiaJob = record => Boolean(getIndiaLocation(record))

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*Your Career at Emerson Starts Here\s*<\/title>/i.test(page)
    && page.includes('https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs')
    && /Let(?:'|&#x27;|&apos;|â€™|’)s Find Your Role/i.test(page)
    && page.includes('/en/corporate/careers/career-opportunities')
    && page.includes('Explore All Opportunities')
    && text.includes('Careers at Emerson')
    && text.includes('We want you to join us in our bold aspiration to make the world healthier, safer, smarter and more sustainable.')
}

export const hasOfficialCandidateExperienceSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Emerson Career Site\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Emerson Career Site Careers["']/i.test(page)
    && /<meta[^>]+property=["']og:description["'][^>]+content=["']Explore Careers at Emerson["']/i.test(page)
    && /<base[^>]+href=["']\/hcmUI\/CandidateExperience\/en\/sites\/CX_1\/?["'][^>]+data-apibaseurl=["']https:\/\/hdjq\.fa\.us2\.oraclecloud\.com:443["'][^>]+data-sitenumber=["']CX_1["']/i.test(page)
    && /siteFavicon\/favicon-16x16\.png\?siteNumber=CX_1/i.test(page)
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

export const buildJobDetailUrl = (jobId) =>
  `${PUBLIC_JOBS_BASE_URL}${normalizeWhitespace(jobId) || ''}`

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

const toListing = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const location = normalizeLocation(getIndiaLocation(record))

  return {
    title: normalizeWhitespace(record.Title),
    company: COMPANY_NAME,
    department: normalizeWhitespace(record.JobFunction || record.Department || record.Category || record.JobFamily),
    location,
    city: extractCity(location),
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId,
    sourceUrl: buildJobDetailUrl(jobId),
    applyUrl: buildJobDetailUrl(jobId),
    employmentType: getEmploymentType(record),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record.ExternalPostedStartDate || record.PostedDate),
    closingDate: normalizeDate(record.ExternalPostedEndDate || record.PostingEndDate),
    jobDescription: joinDescriptionParts(record.ShortDescriptionStr),
    remoteStatus: null,
    siteNumber: SITE_NUMBER,
  }
}

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => toListing(record))
  .filter((job) => job.title && job.jobId)

export const extractPaginationSummary = (payload, { page = 0 } = {}) => {
  const listingSummary = payload?.items?.[0] || {}
  const pageSize = Number(listingSummary.Limit) || DEFAULT_LIMIT
  const totalCount = Number(listingSummary.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    nextOffset,
    totalCount,
  }
}

export const extractJobDetail = (payload, listing = {}) => {
  const detail = getRequisitionDetail(payload)
  const location = normalizeLocation(getIndiaLocation(detail)) || listing.location || null
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const title = normalizeWhitespace(detail.Title) || listing.title || null
  const minimumQualification = normalizeWhitespace(detail.ExternalQualificationsStr || detail.StudyLevel)
    || listing.minimumQualification
    || null
  const jobDescription = joinDescriptionParts(
    detail.ShortDescriptionStr,
    detail.ExternalDescriptionStr,
    detail.ExternalResponsibilitiesStr,
    detail.ExternalQualificationsStr,
  ) || listing.jobDescription || null
  const experienceRequired = extractJobFilterSignals({
    title,
    minimumQualification,
    jobDescription,
    experienceRequired: null,
  }).experienceProfile?.evidence || listing.experienceRequired || null

  return {
    title,
    company: COMPANY_NAME,
    department: normalizeWhitespace(detail.JobFunction || detail.Department || detail.Category || detail.JobFamily)
      || listing.department
      || null,
    location,
    city: extractCity(location) || listing.city || null,
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || buildJobDetailUrl(jobId),
    applyUrl: listing.applyUrl || buildJobDetailUrl(jobId),
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill))
        .filter(Boolean)
      : listing.requiredSkills || [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription,
    remoteStatus: null,
    siteNumber: SITE_NUMBER,
    publicExperienceChecked: true,
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createEmersonIndiaScraper = ({
  maxPages = Infinity,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
  signal,
} = {}) => ({
  async run() {
    const readHandoff = async url => {
      try {
        return await readNativeWithSignal(() => fetchText(url, { signal }), signal)
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const careersHtml = await readHandoff(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Emerson India verified Emerson careers page no longer matches the known first-party handoff')
    }

    const candidateExperienceHtml = await readHandoff(CANDIDATE_EXPERIENCE_URL)
    if (!hasOfficialCandidateExperienceSignal(candidateExperienceHtml)) {
      throw new Error('Emerson India verified Oracle candidate experience page no longer matches the known public shell')
    }

    const jobs = await collectOracleRequisitionJobs({
      source: SOURCE, siteNumber: SITE_NUMBER, buildSearchUrl, buildJobDetailApiUrl,
      extractSearchResults, extractJobDetail, fetchJson, maxPages, maxJobs, signal,
    })
    for (const job of jobs) job.scrapedAt = now()
    return jobs
  },
})

export const run = async (options = {}) => createEmersonIndiaScraper(options).run()

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
