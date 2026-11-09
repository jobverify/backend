import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { collectAciInventory, classifyAciLocations, indiaAciLocation } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aciworldwideindia'
export const COMPANY_NAME = 'ACI Worldwide India'
export const COMPANY_DOMAIN = 'aciworldwide.com'
export const VERIFIED_AT = '2026-07-14'
export const ATS_PLATFORM = 'oracle-cloud'
export const COUNTRY_FILTER = 'India'
export const PAGINATION_STRATEGY = 'offset-query'
export const EXTRACTION_STRATEGY =
  'verified-official-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api'
export const PARSER = 'custom-script'
export const NORMALIZATION_PROFILE = 'engineering-default'
export const CORPORATE_CAREERS_URL = 'https://www.aciworldwide.com/about-aci/careers'
export const CANDIDATE_EXPERIENCE_URL =
  'https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/'
export const WORKSPACE_DOMAIN = 'ebwg.fa.us2.oraclecloud.com'
export const LISTING_API_BASE_URL =
  'https://ebwg.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const DETAIL_API_BASE_URL =
  'https://ebwg.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
export const PUBLIC_JOBS_BASE_URL =
  'https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/'
export const SITE_NUMBER = 'CX'
export const DEFAULT_LOCATION = 'India'
export const DEFAULT_LIMIT = 24

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
    .replace(/<!--[\s\S]*?-->|<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)\s*>/gi, '')
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

const getEffectiveLocation = (record = {}) => normalizeLocation(indiaAciLocation(record))

const isIndiaJob = (record = {}) => classifyAciLocations(record).india

const toListing = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const location = getEffectiveLocation(record)
  const sourceUrl = jobId ? buildJobDetailUrl(jobId) : null

  return {
    title: normalizeWhitespace(record.Title),
    company: COMPANY_NAME,
    department: normalizeWhitespace(record.JobFunction || record.Department || record.Category || record.JobFamily),
    location,
    city: extractCity(location),
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
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

export const hasOfficialCorporateCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers\s*\|\s*ACI Worldwide\s*<\/title>/i.test(page)
    && /href=["']https:\/\/ebwg\.fa\.us2\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX\/["'][^>]*>\s*Explore Opportunities\s*</i.test(page)
    && text.includes('ACI powers the global economy.')
    && text.includes('Every person at ACI makes an impact on payments around the world.')
    && text.includes('Explore Opportunities')
}

export const hasOfficialCandidateExperienceSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*ACI Worldwide Job Opportunities\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']ACI Worldwide Job Opportunities Careers["']/i.test(page)
    && /<meta[^>]+property=["']og:description["'][^>]+content=["']JOIN OUR TEAM["']/i.test(page)
    && /<base[^>]+href=["']\/hcmUI\/CandidateExperience\/en\/sites\/CX\/?["'][^>]+data-apibaseurl=["']https:\/\/ebwg\.fa\.us2\.oraclecloud\.com:443["'][^>]+data-sitenumber=["']CX["']/i.test(page)
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

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => toListing(record))
  .filter((job) => job.title && job.jobId && job.sourceUrl)

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
  const location = getEffectiveLocation(detail) || listing.location || null
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(jobId)
  const sourceDescription = joinDescriptionParts(detail.ExternalDescriptionStr,
    detail.ExternalResponsibilitiesStr, detail.ExternalQualificationsStr)

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: COMPANY_NAME,
    department: normalizeWhitespace(detail.JobFunction || detail.Department || detail.Category || detail.JobFamily)
      || listing.department
      || null,
    location,
    city: extractCity(location) || listing.city || null,
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: stripTags(detail.ExternalQualificationsStr || detail.StudyLevel)
      || listing.minimumQualification
      || null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill))
        .filter(Boolean)
      : listing.requiredSkills || [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription: sourceDescription,
    sourceDescription,
    remoteStatus: null,
    siteNumber: SITE_NUMBER,
  }
}

export const createAciWorldwideIndiaScraper = (options = {}) => ({
  async run(runOptions = {}) {
    return collectAciInventory({ ...options, ...runOptions }, {
      corporate: CORPORATE_CAREERS_URL, candidate: CANDIDATE_EXPERIENCE_URL,
      listing: LISTING_API_BASE_URL, detail: DETAIL_API_BASE_URL,
      isCorporate: hasOfficialCorporateCareersSignal, isCandidate: hasOfficialCandidateExperienceSignal,
      search: buildSearchUrl, detailURL: buildJobDetailApiUrl,
      extractListings: extractSearchResults, extractDetail: extractJobDetail,
    })
  },
})

export const run = async (options = {}) => createAciWorldwideIndiaScraper(options).run()

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
