import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { KI_MOBILITY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = KI_MOBILITY_CATALOG.source
export const COMPANY = KI_MOBILITY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = KI_MOBILITY_CATALOG.officialBrandName
export const VERIFIED_ON = KI_MOBILITY_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = KI_MOBILITY_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = KI_MOBILITY_CATALOG
export const CAREERS_PAGE_URL = KI_MOBILITY_CATALOG.companyCareerPage
export const ADP_BOARD_URL = KI_MOBILITY_CATALOG.officialJobsBoardUrl

const CID = 'd4c8f64f-44e0-49a4-95d7-5c8d1767e36d'
const CC_ID = '19000101_000001'
const LANG = 'en_US'
const LOCALE = 'en_US'
const JOBS_API_BASE_URL =
  'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions'
const SEARCH_FILTERS_API_BASE_URL = `${JOBS_API_BASE_URL}/getSearchFilters`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HTML_ENTITY_REPLACEMENTS = [
  [/&amp;/gi, '&'],
  [/&nbsp;/gi, ' '],
  [/&#39;|&apos;/gi, '\''],
  [/&#34;|&quot;/gi, '"'],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
]

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (const [pattern, replacement] of HTML_ENTITY_REPLACEMENTS) {
    decoded = decoded.replace(pattern, replacement)
  }

  return decoded
}

const stripTags = (value) => decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeWhitespace = (value) => {
  const normalized = stripTags(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizeCountryToken = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null
  if (normalized === 'IN' || normalized === 'IND' || normalized === 'INDIA') return 'India'
  if (normalized === 'US' || normalized === 'USA' || normalized === 'UNITED STATES') return 'United States'
  if (normalized === 'CA' || normalized === 'CANADA') return 'Canada'
  if (normalized === 'GB' || normalized === 'UK' || normalized === 'UNITED KINGDOM') {
    return 'United Kingdom'
  }
  return normalizeWhitespace(value)
}

const buildCommonParams = () => {
  const params = new URLSearchParams()
  params.set('cid', CID)
  params.set('ccId', CC_ID)
  params.set('lang', LANG)
  params.set('locale', LOCALE)
  return params
}

export const buildJobsApiUrl = ({ top = 100 } = {}) => {
  const params = buildCommonParams().toString()
  return `${JOBS_API_BASE_URL}?${params}&$top=${encodeURIComponent(String(top))}`
}

export const buildSearchFiltersApiUrl = () =>
  `${SEARCH_FILTERS_API_BASE_URL}?${buildCommonParams().toString()}`

export const buildDetailApiUrl = (jobId) =>
  `${JOBS_API_BASE_URL}/${encodeURIComponent(jobId)}?${buildCommonParams().toString()}`

export const buildJobDetailUrl = (jobId) => {
  const url = new URL(ADP_BOARD_URL)
  url.searchParams.set('jobId', String(jobId))
  return url.toString()
}

const getStringField = (requisition, codeValue) => {
  const fields = Array.isArray(requisition?.customFieldGroup?.stringFields)
    ? requisition.customFieldGroup.stringFields
    : []

  for (const field of fields) {
    if (field?.nameCode?.codeValue === codeValue) {
      return normalizeWhitespace(field.stringValue)
    }
  }

  return null
}

const extractLocationParts = (requisition = {}) => {
  const locationEntry = Array.isArray(requisition.requisitionLocations)
    ? requisition.requisitionLocations[0]
    : null
  const locationText = normalizeWhitespace(locationEntry?.nameCode?.shortName)
  const address = locationEntry?.address || {}
  const parts = locationText ? locationText.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean) : []
  const city = normalizeWhitespace(address.cityName) || parts[0] || null
  const state = normalizeWhitespace(address?.countrySubdivisionLevel1?.codeValue)
    || (parts.length >= 3 ? parts[1] : null)
  let country = normalizeCountryToken(parts.length > 0 ? parts[parts.length - 1] : null)

  if (!country && /india/i.test(locationText || '')) {
    country = 'India'
  }

  return {
    city,
    state,
    country,
  }
}

const extractExperienceRequired = (description) => {
  const normalized = normalizeWhitespace(description)
  if (!normalized) return null

  const match = normalized.match(/(\d+\+?(?:\s*-\s*\d+\+?)?\s+years?)/i)
  return match ? normalizeWhitespace(match[1]) : null
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Ki Mobility - Careers\s*<\/title>/i.test(page)
    && /Careers at Ki/i.test(page)
    && /career with a purpose/i.test(page)
    && /workforcenow\.adp\.com\/mascsr\/default\/mdf\/recruitment\/recruitment\.html\?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d/i.test(page)
}

export const extractOfficialJobsBoardUrl = (html) => {
  const page = decodeHtmlEntities(String(html ?? ''))
  const match = page.match(/https:\/\/workforcenow\.adp\.com\/mascsr\/default\/mdf\/recruitment\/recruitment\.html\?[^"'\s<]+/i)
  return normalizeWhitespace(match?.[0])
}

export const hasOfficialAdpBoardSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Recruitment\s*<\/title>/i.test(page)
    && /\bid=["']recruitment_root["']/i.test(page)
    && /applicationName:\s*['"]recruitment['"]/i.test(page)
    && /\/mascsr\/default\/mdf\/recruitment\/recruitment\.[a-z0-9]+\.js/i.test(page)
}

export const extractLocationFilterValues = (payload = {}) => {
  const locationFilter = (Array.isArray(payload?.data) ? payload.data : [])
    .find((entry) => normalizeWhitespace(entry?.filterType) === 'FILTER LOCATION')

  return Array.isArray(locationFilter?.searchFilterInfo)
    ? locationFilter.searchFilterInfo
      .map((entry) => {
        const rawValue = normalizeWhitespace(entry?.value)
        if (rawValue && !/LOCATION_/i.test(rawValue)) return rawValue
        return normalizeWhitespace(entry?.oid)
      })
      .filter(Boolean)
    : []
}

const normalizeJobSummary = (requisition = {}) => {
  const title = normalizeWhitespace(requisition.requisitionTitle)
  const jobId = getStringField(requisition, 'ExternalJobID')
  const requisitionId = normalizeWhitespace(requisition.clientRequisitionID) || jobId
  const { city, state, country } = extractLocationParts(requisition)
  const location = [city, state, country].filter(Boolean).join(', ') || null
  const sourceUrl = jobId ? buildJobDetailUrl(jobId) : null

  if (!title || !jobId || !country || !location || !sourceUrl) return null

  return {
    title,
    company: COMPANY,
    department: getStringField(requisition, 'HomeDepartment'),
    location,
    city,
    state,
    country,
    jobId,
    requisitionId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeEmploymentType(requisition?.workLevelCode?.shortName),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(requisition.postDate),
    closingDate: null,
    jobDescription: null,
  }
}

export const extractIndiaJobSummaries = (payload = {}) => (Array.isArray(payload?.jobRequisitions)
  ? payload.jobRequisitions
  : [])
  .map(normalizeJobSummary)
  .filter((job) => job?.country === 'India')

const enrichJobWithDetail = (job, detailPayload = {}) => {
  const jobDescription = normalizeWhitespace(detailPayload?.requisitionDescription)

  return {
    ...job,
    experienceRequired: job.experienceRequired || extractExperienceRequired(jobDescription),
    jobDescription: jobDescription || job.jobDescription,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'kimobility',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'kimobility',
  timeoutMs: 15000,
})

export const createKiMobilityScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official Ki Mobility careers page')
    }

    if (extractOfficialJobsBoardUrl(careersPageHtml) !== ADP_BOARD_URL) {
      throw new Error('Ki Mobility careers page no longer points to the verified public ADP board')
    }

    const adpBoardHtml = await fetchText(ADP_BOARD_URL)
    if (!hasOfficialAdpBoardSignal(adpBoardHtml)) {
      throw new Error('Response is not the verified public Ki Mobility ADP board')
    }

    const searchFiltersPayload = await fetchJson(buildSearchFiltersApiUrl())
    if (!Array.isArray(searchFiltersPayload?.data)) {
      throw new Error('Ki Mobility search filters API no longer returns the verified payload shape')
    }

    const requisitionsPayload = await fetchJson(buildJobsApiUrl())
    if (!Array.isArray(requisitionsPayload?.jobRequisitions)) {
      throw new Error('Ki Mobility job requisitions API no longer returns the verified payload shape')
    }

    const summaries = extractIndiaJobSummaries(requisitionsPayload)
    const selectedSummaries = Number.isInteger(maxJobs) ? summaries.slice(0, maxJobs) : summaries
    const jobs = []

    for (const summary of selectedSummaries) {
      const detailPayload = await fetchJson(buildDetailApiUrl(summary.jobId))
      jobs.push(enrichJobWithDetail(summary, detailPayload))
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createKiMobilityScraper().run(options)

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
