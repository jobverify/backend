import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { ASTER_DM_HEALTHCARE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const OFFICIAL_HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTextLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

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

const countryNameFromCode = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (normalized === 'IN') return COUNTRY_FILTER
  return normalizeWhitespace(value)
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const buildLocationFromWorkLocation = (record = {}) => {
  const location = Array.isArray(record?.workLocation) && record.workLocation[0]
    ? record.workLocation[0]
    : Array.isArray(record?.otherWorkLocations) && record.otherWorkLocations[0]
      ? record.otherWorkLocations[0]
      : null

  if (!location) return null

  const parts = unique([
    normalizeWhitespace(location.TownOrCity),
    normalizeWhitespace(location.Region2),
    normalizeWhitespace(location.Region1),
    countryNameFromCode(location.Country),
  ])

  if (parts.length > 0) {
    return parts.join(', ')
  }

  const fallback = unique([
    normalizeWhitespace(location.LocationName),
    countryNameFromCode(location.Country),
  ])

  return fallback.length > 0 ? fallback.join(', ') : null
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^india$/i.test(normalized)) return COUNTRY_FILTER
  return normalized
}

const getEffectiveLocation = (record = {}) =>
  buildLocationFromWorkLocation(record)
  || normalizeLocation(record.PrimaryLocation)
  || normalizeLocation(record?.secondaryLocations?.[0]?.Name)

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const getDepartment = (record = {}) => normalizeWhitespace(
  record.Department
    || record.JobFunction
    || record.Category
    || record.JobFamily
    || record.BusinessUnit
    || record.Organization,
)

const getEmploymentType = (record = {}) => normalizeWhitespace(
  record.JobSchedule
    || record.JobType
    || record.WorkerType
    || record.ContractType,
)

const getQualificationLines = (record = {}) => {
  const lines = extractTextLines(record.ExternalQualificationsStr)
  if (lines.length > 0) return lines

  const fallback = normalizeWhitespace(record.StudyLevel)
  return fallback ? [fallback] : []
}

const extractMinimumQualification = (record = {}) =>
  getQualificationLines(record).find((line) => !/\byears?\b/i.test(line)) || null

const extractExperienceRequired = (record = {}) =>
  getQualificationLines(record).find((line) => /\byears?\b/i.test(line)) || null

const joinDescriptionParts = (...parts) => {
  const description = parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' ')

  return normalizeWhitespace(description)
}

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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Aster DM Healthcare,\s*India\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.asterdmhealthcare\.in\/["'][^>]*>/i.test(page)
    && /href=["'](?:https:\/\/www\.asterdmhealthcare\.in)?\/careers["']/i.test(page)
    && /title=["']CAREERS["']/i.test(page)
    && text.includes('Making millions of lives better with our network of comprehensive healthcare.')
    && text.includes('Aster DM Healthcare works on a singular mission, to make quality healthcare accessible to all.')
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const hasCurrentOrLegacyHero =
    text.includes('Build Your Future Today')
    || text.includes('United to make a healthier planet for every life.')
  const hasCurrentOrLegacyOpportunityCopy =
    text.includes("Explore Aster career opportunities. We're looking for skilled professionals who are passionate about healthcare.")
    || text.includes("Explore Aster career opportunities we're looking for skilled professionals who are passionate about healthcare. Browse our current job vacancies and find your next role with us.")

  return /<title>\s*Aster DM Healthcare Careers\s*\|\s*Build Your Future Today\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.asterdmhealthcare\.in\/careers["'][^>]*>/i.test(page)
    && /https:\/\/hcdt\.fa\.us2\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX/i.test(page)
    && hasCurrentOrLegacyHero
    && hasCurrentOrLegacyOpportunityCopy
    && text.includes('Explore Jobs')
    && text.includes('View Openings')
    && text.includes('How do I apply for a role at Aster?')
}

export const hasOfficialCandidateExperienceSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Aster DM Healthcare\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Aster DM Healthcare Careers["'][^>]*>/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Aster DM Healthcare["'][^>]*>/i.test(page)
    && /<base[^>]+href=["']\/hcmUI\/CandidateExperience\/en\/sites\/CX\/?["'][^>]+data-apibaseurl=["']https:\/\/hcdt\.fa\.us2\.oraclecloud\.com:443["'][^>]+data-sitenumber=["']CX["']/i.test(page)
}

export const hasCurrentHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Aster Quality Care\s*<\/title>/i.test(page)
    && /Aster DM Quality Care Ltd\./i.test(page)
    && /Formerly Aster DM Healthcare Ltd\./i.test(page)
    && /<a\b[^>]+href=["']\/careers["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
}

export const hasCurrentCareersIntakeSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Aster Quality Care\s*<\/title>/i.test(page)
    && /Aster DM Quality Care Ltd\./i.test(page)
    && /Formerly Aster DM Healthcare Ltd\./i.test(page)
    && /Build a Career That Makes Every Moment Matter/i.test(page)
    && /Across Aster, CARE, Evercare and KIMSHEALTH Bangladesh/i.test(page)
    && /<form\b[^>]+id=["']career-contact-form["'][^>]+data-action=["']https:\/\/www\.asterqualitycare\.com\/careers\/contact["']/i.test(page)
    && /<input\b[^>]+type=["']file["'][^>]+name=["']resume["']/i.test(page)
    && !/hcdt\.fa\.us2\.oraclecloud\.com/i.test(page)
    && !/href=["'][^"']*(?:\/jobs?\/|\/openings|\/positions)/i.test(page)
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

export const buildJobApplyUrl = (jobId) =>
  `${buildJobDetailUrl(jobId)}/apply`

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => {
    const jobId = normalizeWhitespace(record.Id)
    const location = getEffectiveLocation(record)

    return {
      title: normalizeWhitespace(record.Title),
      company: COMPANY_NAME,
      department: getDepartment(record),
      location,
      city: extractCity(location),
      country: COUNTRY_FILTER,
      jobId,
      requisitionId: jobId,
      sourceUrl: buildJobDetailUrl(jobId),
      applyUrl: buildJobApplyUrl(jobId),
      employmentType: getEmploymentType(record),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeDate(record.ExternalPostedStartDate || record.PostedDate),
      closingDate: normalizeDate(record.ExternalPostedEndDate || record.PostingEndDate),
      jobDescription: joinDescriptionParts(record.ShortDescriptionStr),
      remoteStatus: normalizeWhitespace(record.WorkplaceType) || null,
      siteNumber: SITE_NUMBER,
    }
  })
  .filter((job) => job.title && job.jobId)

export const extractPaginationSummary = (payload, { page = 0 } = {}) => {
  const listingSummary = payload?.items?.[0] || {}
  const pageSize = Number(listingSummary.Limit) || DEFAULT_LIMIT
  const totalCount = Number(listingSummary.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    totalCount,
  }
}

export const extractJobDetail = (payload, listing = {}) => {
  const detail = getRequisitionDetail(payload)
  const location = getEffectiveLocation(detail) || listing.location || null
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: COMPANY_NAME,
    department: getDepartment(detail) || listing.department || null,
    location,
    city: extractCity(location) || listing.city || null,
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || buildJobDetailUrl(jobId),
    applyUrl: listing.applyUrl || buildJobApplyUrl(jobId),
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired: extractExperienceRequired(detail) || listing.experienceRequired || null,
    minimumQualification: extractMinimumQualification(detail) || listing.minimumQualification || null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill))
        .filter(Boolean)
      : listing.requiredSkills || [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription: joinDescriptionParts(
      detail.ExternalDescriptionStr,
      detail.ExternalResponsibilitiesStr,
      detail.ShortDescriptionStr,
    ) || listing.jobDescription || null,
    remoteStatus: normalizeWhitespace(detail.WorkplaceType) || listing.remoteStatus || null,
    siteNumber: SITE_NUMBER,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createAsterDmHealthcareScraper = ({
  fetchText = defaultFetchText,
} = {}) => ({
  async run() {
    const homepageHtml = await fetchText(OFFICIAL_HOMEPAGE_URL)
    if (!hasCurrentHomepageSignal(homepageHtml)) {
      throw new Error('Aster DM Healthcare verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (!hasCurrentCareersIntakeSignal(careersHtml)) {
      throw new Error('Aster DM Healthcare verified careers page no longer matches the known first-party handoff')
    }

    // The merged company's current careers surface is a general resume intake,
    // with no published requisitions or handoff to the legacy Oracle board.
    return []
  },
})

export const run = async (options = {}) => createAsterDmHealthcareScraper(options).run()

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
