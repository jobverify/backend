import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const LISTING_API_BASE_URL = 'https://ecyq.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const DETAIL_API_BASE_URL = 'https://ecyq.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
export const API_BASE_URL = LISTING_API_BASE_URL
export const PUBLIC_CAREERS_BASE_URL = 'https://ecyq.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/'
export const SITE_NUMBER = 'CX_1'
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

const formatYears = (minimum, maximum = null, suffix = '') => {
  if (!minimum) return null
  const singular = Number.parseFloat(maximum ?? minimum) === 1 && !maximum && suffix !== '+'
  if (maximum) return `${minimum}-${maximum} years`
  return `${minimum}${suffix} ${singular ? 'year' : 'years'}`
}

const hasExperienceContext = (text, matchIndex, matchLength) => {
  const start = Math.max(0, matchIndex - 48)
  const end = Math.min(text.length, matchIndex + matchLength + 48)
  return /\b(experience|required|qualification|qualifications|minimum|preferred|desired|intern|graduate|fresher)\b/i
    .test(text.slice(start, end))
}

const extractExperienceRequired = (...parts) => {
  const text = normalizeWhitespace(
    parts
      .map((part) => stripTags(part))
      .filter(Boolean)
      .join(' '),
  )

  if (!text) return null

  const rangeMatch = text.match(
    /\b(?:required experience|years of experience|required years of experience|total years of experience|experience required|experience)\b\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)(?:\s*(?:years?|yrs?))?\b/i,
  )
  if (rangeMatch) {
    return formatYears(rangeMatch[1], rangeMatch[2])
  }

  const plusMatch = text.match(
    /\b(?:required experience|years of experience|required years of experience|total years of experience|experience required|experience)\b\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(\+|plus)(?:\s*(?:years?|yrs?))?\b/i,
  )
  if (plusMatch) {
    return formatYears(plusMatch[1], null, '+')
  }

  const singleMatch = text.match(
    /\b(?:required experience|years of experience|required years of experience|total years of experience|experience required|minimum of|minimum|at least)\b[\s:-]*(\d+(?:\.\d+)?)(?:\s*(?:years?|yrs?))?\b(?:\s+of\s+experience)?/i,
  )
  if (singleMatch) {
    return formatYears(singleMatch[1])
  }

  const contextualRangeMatch = /\b(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b(?:\s+of\s+experience)?/i.exec(text)
  if (contextualRangeMatch && hasExperienceContext(text, contextualRangeMatch.index, contextualRangeMatch[0].length)) {
    return formatYears(contextualRangeMatch[1], contextualRangeMatch[2])
  }

  const contextualPlusMatch = /\b(\d+(?:\.\d+)?)\s*(\+|plus)\s*(?:years?|yrs?)\b(?:\s+of\s+experience)?/i.exec(text)
  if (contextualPlusMatch && hasExperienceContext(text, contextualPlusMatch.index, contextualPlusMatch[0].length)) {
    return formatYears(contextualPlusMatch[1], null, '+')
  }

  const contextualSingleMatch = /\b(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b(?:\s+of\s+experience)?/i.exec(text)
  if (contextualSingleMatch && hasExperienceContext(text, contextualSingleMatch.index, contextualSingleMatch[0].length)) {
    return formatYears(contextualSingleMatch[1])
  }

  return null
}

const toTitleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .split(' ')
  .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
  .join(' ') || null

const normalizeLocation = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => toTitleCase(part))
  .filter(Boolean)
  .join(', ') || null

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

const isIndiaLocation = (location) => /(?:^|,)\s*india\s*$/i.test(location || '')

const getIndiaSecondaryLocation = (record = {}) => record.secondaryLocations
  ?.find((location) => location?.CountryCode === 'IN' || isIndiaLocation(location?.Name))
  ?.Name || null

const isIndiaJob = (record = {}) =>
  normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase() === 'IN'
  || isIndiaLocation(record.PrimaryLocation)
  || Boolean(getIndiaSecondaryLocation(record))

const getLocation = (record = {}) => normalizeLocation(
  isIndiaJob({ ...record, secondaryLocations: [] })
    ? record.PrimaryLocation
    : getIndiaSecondaryLocation(record),
)

const getRequisitionList = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => Array.isArray(item?.requisitionList) ? item.requisitionList : [])
  }

  return Array.isArray(payload?.requisitionList) ? payload.requisitionList : []
}

const getRequisitionDetail = (payload) => {
  if (Array.isArray(payload?.items) && payload.items[0]) {
    return payload.items[0]
  }

  return payload || {}
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const getEmploymentType = (record = {}) =>
  normalizeWhitespace(
    record.JobSchedule
      || record.RequisitionType
      || record.JobType
      || record.WorkerType
      || record.ContractType,
  )

export const buildSearchUrl = ({
  page = 0,
  limit = DEFAULT_LIMIT,
  location = DEFAULT_LOCATION,
} = {}) => {
  const normalizedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit

  return `${LISTING_API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${normalizedLimit},offset=${offset},location=${location}`
}

export const buildJobDetailUrl = (jobId) => `${PUBLIC_CAREERS_BASE_URL}${normalizeWhitespace(jobId) || ''}`

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

const toListing = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const location = getLocation(record)
  const detailUrl = jobId ? buildJobDetailUrl(jobId) : null

  return {
    title: normalizeWhitespace(record.Title),
    company: 'DNV',
    department: normalizeWhitespace(record.Organization || record.Department || record.JobFunction || record.JobFamily),
    location,
    city: location?.split(',')[0] || null,
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: getEmploymentType(record),
    experienceRequired: extractExperienceRequired(
      record.ShortDescriptionStr,
      record.ExternalResponsibilitiesStr,
      record.ExternalQualificationsStr,
    ),
    minimumQualification: stripTags(record.StudyLevel || record.ExternalQualificationsStr),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record.PostedDate || record.ExternalPostedStartDate),
    closingDate: normalizeDate(record.PostingEndDate || record.ExternalPostedEndDate),
    jobDescription: joinDescriptionParts(
      record.ShortDescriptionStr,
      record.ExternalResponsibilitiesStr,
      record.ExternalQualificationsStr,
    ),
  }
}

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter(isIndiaJob)
  .map(toListing)
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
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const location = getLocation(detail) || listing.location || null
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(jobId)
  const description = joinDescriptionParts(
    detail.ExternalDescriptionStr,
    detail.ExternalResponsibilitiesStr,
    detail.ExternalQualificationsStr,
    detail.ShortDescriptionStr,
  )

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: 'DNV',
    department: normalizeWhitespace(
      detail.Organization
        || detail.Department
        || detail.JobFunction
        || detail.JobFamily
        || detail.Category,
    ) || listing.department || null,
    location,
    city: location?.split(',')[0] || listing.city || null,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired: extractExperienceRequired(
      detail.ExternalDescriptionStr,
      detail.ExternalResponsibilitiesStr,
      detail.ExternalQualificationsStr,
      detail.ShortDescriptionStr,
    ) || listing.experienceRequired || null,
    minimumQualification: stripTags(detail.StudyLevel || detail.ExternalQualificationsStr)
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
    jobDescription: description || listing.jobDescription || null,
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'dnv',
  timeoutMs: 30000,
})

export const createDnvScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
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
        const detail = extractJobDetail(detailPayload, listing)

        jobs.push({
          ...detail,
          source: 'dnv',
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

export const run = async (options = {}) => createDnvScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running DNV scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'dnv')
    console.log('DB result:', result)
  }
}
