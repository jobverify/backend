import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { buildHttpError } from '../../scraper-support/utils/fetch.js'
import { collectOracleRequisitionJobs } from '../../scraper-support/utils/oracleRequisitionInventory.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const LISTING_API_BASE_URL = 'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
const DETAIL_API_BASE_URL = 'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
const PUBLIC_CAREERS_BASE_URL = 'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/'
const SITE_NUMBER = 'CX_1'
const DEFAULT_LOCATION = 'India'
const DEFAULT_LIMIT = 24

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&amp;/gi, '&')
  .replace(/&ge;/gi, '>=')

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
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+:/g, ':'),
)

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^india$/i.test(normalized)) return 'India'

  return normalized
    .split(',')
    .map((part) => toTitleCase(part))
    .filter(Boolean)
    .join(', ')
}

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0] || null
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

const getIndiaLocation = (record = {}) => {
  const locations = [{ CountryCode: record.PrimaryLocationCountry, Name: record.PrimaryLocation },
    ...(Array.isArray(record.secondaryLocations) ? record.secondaryLocations : [])]
  const location = locations.find(item => (nativeCountryName(item?.CountryCode)
    || nativeLocationCountryName(item?.Name || item?.LocationName)) === 'India')
  return location ? normalizeWhitespace(location.Name || location.LocationName) || 'India' : null
}
const isIndiaJob = record => Boolean(getIndiaLocation(record))

const getFlexFieldValue = (fields = [], labelPattern) => {
  if (!Array.isArray(fields)) return null
  const match = fields.find((field) => labelPattern.test(normalizeWhitespace(field?.Prompt) || ''))
  return normalizeWhitespace(match?.Value)
}

const normalizeExperience = (fields = []) => {
  const min = getFlexFieldValue(fields, /^Minimum Experience/i)
  const max = getFlexFieldValue(fields, /^Maximum Experience/i)
  if (min && max) return `${min}-${max} years`
  if (min) return `${min}+ years`
  return null
}

const toJob = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const detailUrl = jobId ? buildJobDetailUrl(jobId) : null
  const location = getIndiaLocation(record)

  return {
    title: normalizeWhitespace(record.Title),
    company: 'Zensar',
    department: normalizeWhitespace(record.Department || record.JobFunction || record.JobFamily),
    location: normalizeLocation(location),
    city: extractCity(location),
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(record.StudyLevel || record.ExternalQualificationsStr),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record.PostedDate || record.ExternalPostedStartDate),
    closingDate: normalizeDate(record.PostingEndDate || record.ExternalPostedEndDate),
    jobDescription: joinDescriptionParts(
      record.ShortDescriptionStr,
      record.ExternalResponsibilitiesStr,
    ),
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

export const buildJobDetailUrl = (jobId) => `${PUBLIC_CAREERS_BASE_URL}${jobId}`

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => toJob(record))
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
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(detail.Id)
  const location = getIndiaLocation(detail)
  const hasAuthoredBody = [detail.ExternalDescriptionStr, detail.ExternalResponsibilitiesStr, detail.ExternalQualificationsStr]
    .map(stripTags).some(value => value && !/^ok$/i.test(value) && !/^[\p{P}\p{S}\s]+$/u.test(value))

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: 'Zensar',
    department: normalizeWhitespace(
      detail.Department || detail.JobFunction || detail.JobFamily,
    ) || listing.department || null,
    location: normalizeLocation(location) || listing.location || null,
    city: extractCity(location) || listing.city || null,
    jobId: normalizeWhitespace(detail.Id) || listing.jobId || null,
    requisitionId: normalizeWhitespace(detail.Id) || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(detail.RequisitionType || detail.JobType || detail.WorkerType || detail.ContractType),
    experienceRequired: normalizeExperience(detail.requisitionFlexFields) || listing.experienceRequired || null,
    minimumQualification: normalizeWhitespace(detail.StudyLevel),
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill))
        .filter(Boolean)
      : [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription: joinDescriptionParts(
      detail.ExternalDescriptionStr,
      detail.ShortDescriptionStr,
      detail.ExternalResponsibilitiesStr,
      detail.ExternalQualificationsStr,
    ) || listing.jobDescription || null,
    ...(!hasAuthoredBody ? { sourceDetailComplete: false, sourceDetailFailureKind: 'missing-content' } : {}),
  }
}

const defaultFetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw buildHttpError(response, url)
  }

  return response.json()
}

export const run = async ({
  maxPages = Infinity,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchJson = defaultFetchJson,
  signal,
} = {}) => collectOracleRequisitionJobs({
  source: 'zensar', siteNumber: SITE_NUMBER, buildSearchUrl, buildJobDetailApiUrl,
  extractSearchResults, extractJobDetail, fetchJson, maxPages, maxJobs, signal,
  // This employer publishes distinct Oracle IDs such as 152155_2. Retain the
  // suffix in listing, native detail and public links; never collapse to a base ID.
  isNativeRoleId: value => /^\d{1,24}(?:_[1-9]\d{0,6})?$/.test(String(value ?? '')),
})

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Zensar scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'zensar')
    console.log('DB result:', result)
    process.exit(0)
  }
}
