import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { TATA_TELESERVICES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_JOBS_HANDOFF_URL = PROVIDER_METADATA.officialJobsHandoffUrl
export const CANDIDATE_EXPERIENCE_URL = PROVIDER_METADATA.oracleCandidateExperienceUrl
export const WORKSPACE_DOMAIN = PROVIDER_METADATA.workspaceDomain
export const LISTING_API_BASE_URL = PROVIDER_METADATA.listingApiBaseUrl
export const DETAIL_API_BASE_URL = PROVIDER_METADATA.detailApiBaseUrl
export const PUBLIC_JOBS_BASE_URL = PROVIDER_METADATA.publicJobsBaseUrl
export const SITE_NUMBER = PROVIDER_METADATA.siteNumber
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const DEFAULT_LOCATION = COUNTRY_FILTER
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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  return parsed.toISOString().slice(0, 10)
}

const buildLocationFromWorkLocation = (record = {}) => {
  const location = Array.isArray(record?.workLocation) && record.workLocation[0]
    ? record.workLocation[0]
    : null

  if (!location) return null

  const parts = [
    normalizeWhitespace(location.TownOrCity),
    normalizeWhitespace(location.Region2),
    normalizeWhitespace(location.Country) === 'IN' ? COUNTRY_FILTER : normalizeWhitespace(location.Country),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : null
}

const effectiveLocation = (record = {}) =>
  buildLocationFromWorkLocation(record)
  || normalizeWhitespace(record.PrimaryLocation)
  || normalizeWhitespace(record?.secondaryLocations?.[0]?.Name)

const cityFromLocation = (value) => normalizeWhitespace(value)?.split(',')[0]?.trim() || null

const extractExperienceRequired = (record = {}) => {
  const text = [
    stripTags(record.ExternalDescriptionStr),
    stripTags(record.ExternalQualificationsStr),
  ].filter(Boolean).join(' ')

  const rangeMatch = text.match(/\b(?:at least\s*)?(\d+\s*-\s*\d+)\s+years?\b/i)
  if (rangeMatch) return normalizeWhitespace(`${rangeMatch[1]} years`)

  const plusMatch = text.match(/\b(?:at least\s*)?(\d+\+)\s+years?\b/i)
  if (plusMatch) return normalizeWhitespace(`${plusMatch[1]} years`)

  return null
}

const employmentTypeFromRecord = (record = {}) => normalizeWhitespace(
  record.JobSchedule
    || record.RequisitionType
    || record.JobType
    || record.WorkerType
    || record.ContractType,
)

const departmentFromRecord = (record = {}) => normalizeWhitespace(
  record.JobFunction
    || record.Department
    || record.Category
    || record.JobFamily,
)

const joinedDescription = (...parts) => normalizeWhitespace(parts.map((part) => stripTags(part)).filter(Boolean).join(' '))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Tata Tele Business Services\s*-\s*Careers\s*<\/title>/i.test(page)
    && text.includes('Your journey to Do Big starts here!')
    && text.includes('Work on technology that matters.')
    && new RegExp(
      `<a[^>]+href=["']${OFFICIAL_JOBS_HANDOFF_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*View All Openings\\s*<`,
      'i',
    ).test(page)
}

export const hasOfficialCandidateExperienceSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Tata Teleservices Career Portal\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Tata Teleservices Career Portal Careers["'][^>]*>/i.test(page)
    && /<meta[^>]+property=["']og:description["'][^>]+content=["']Join Our Team["'][^>]*>/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Tata Teleservices Career Portal["'][^>]*>/i.test(page)
    && /data-apibaseurl=["']https:\/\/fa-evmm-saasfaprod1\.fa\.ocs\.oraclecloud\.com:443["']/i.test(page)
    && /<base[^>]+href=["']\/hcmUI\/CandidateExperience\/en\/sites\/CX_(?:1|1001)\/?["'][^>]*>/i.test(page)
    && /data-sitenumber=["']CX_(?:1|1001)["']/i.test(page)
}

export const hasVerifiedTataListingSignal = (payload = {}) => {
  const summary = payload?.items?.[0]
  const siteNumber = normalizeWhitespace(summary?.SiteNumber)
  const totalCount = Number(summary?.TotalJobsCount)
  const organizationNames = Array.isArray(summary?.organizationsFacet)
    ? summary.organizationsFacet.map((item) => normalizeWhitespace(item?.Name)).filter(Boolean)
    : []
  const workplaceTypes = Array.isArray(summary?.workplaceTypesFacet)
    ? summary.workplaceTypesFacet.map((item) => normalizeWhitespace(item?.Name)).filter(Boolean)
    : []

  return siteNumber === SITE_NUMBER
    && Number.isFinite(totalCount)
    && totalCount > 0
    && organizationNames.some((name) => /Tata Teleservices/i.test(name))
    && workplaceTypes.includes('On-site')
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

export const buildJobDetailUrl = (jobId) => `${PUBLIC_JOBS_BASE_URL}${normalizeWhitespace(jobId) || ''}`

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

export const extractSearchResults = (payload = {}) => {
  const listings = Array.isArray(payload?.items?.[0]?.requisitionList) ? payload.items[0].requisitionList : []

  return listings
    .filter((record) => normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase() === 'IN')
    .map((record) => {
      const jobId = normalizeWhitespace(record.Id)
      const location = effectiveLocation(record)
      const sourceUrl = jobId ? buildJobDetailUrl(jobId) : null

      return {
        title: normalizeWhitespace(record.Title),
        company: COMPANY_NAME,
        department: departmentFromRecord(record),
        location,
        city: cityFromLocation(location),
        country: COUNTRY_FILTER,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: employmentTypeFromRecord(record),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeDate(record.ExternalPostedStartDate || record.PostedDate),
        closingDate: normalizeDate(record.ExternalPostedEndDate || record.PostingEndDate),
        jobDescription: joinedDescription(record.ShortDescriptionStr),
        remoteStatus: normalizeWhitespace(record.WorkplaceType) || null,
        siteNumber: SITE_NUMBER,
      }
    })
    .filter((job) => job.title && job.jobId && job.sourceUrl)
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const detail = Array.isArray(payload?.items) && payload.items[0] ? payload.items[0] : payload
  const location = effectiveLocation(detail) || listing.location || null
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(jobId)

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: COMPANY_NAME,
    department: departmentFromRecord(detail) || listing.department || null,
    location,
    city: cityFromLocation(location) || listing.city || null,
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(detail.JobSchedule) || listing.employmentType || null,
    experienceRequired: extractExperienceRequired(detail) || listing.experienceRequired || null,
    minimumQualification: normalizeWhitespace(detail.StudyLevel) || listing.minimumQualification || null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills.map((skill) => normalizeWhitespace(skill?.Skill)).filter(Boolean)
      : listing.requiredSkills || [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription: joinedDescription(detail.ExternalDescriptionStr, detail.CorporateDescriptionStr) || listing.jobDescription || null,
    remoteStatus: normalizeWhitespace(detail.WorkplaceType) || listing.remoteStatus || null,
    siteNumber: SITE_NUMBER,
  }
}

export const createTataTeleservicesScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    const officialCareersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (!hasOfficialCareersPageSignal(officialCareersHtml)) {
      throw new Error('Tata Teleservices verified official Tata Teleservices careers page no longer matches the known first-party handoff')
    }

    const candidateExperienceHtml = await fetchText(CANDIDATE_EXPERIENCE_URL)
    if (!hasOfficialCandidateExperienceSignal(candidateExperienceHtml)) {
      throw new Error('Tata Teleservices verified Oracle candidate experience page no longer matches the known public shell')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ page }))
      if (!hasVerifiedTataListingSignal(payload)) {
        throw new Error('Tata Teleservices verified Tata listing contract no longer matches the known Oracle board')
      }

      const listings = extractSearchResults(payload)
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

      const totalCount = Number(payload?.items?.[0]?.TotalJobsCount) || 0
      const limit = Number(payload?.items?.[0]?.Limit) || DEFAULT_LIMIT
      if ((page + 1) * limit >= totalCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createTataTeleservicesScraper(options).run()

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
