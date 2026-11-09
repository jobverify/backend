import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { collectOracleRequisitionJobs } from '../../scraper-support/utils/oracleRequisitionInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'chaseindia'
export const COMPANY_NAME = 'Chase India'
export const COMPANY_DOMAIN = 'jpmorganchase.com'
export const ATS_PLATFORM = 'oracle-cloud'
export const COUNTRY_FILTER = 'India'
export const PAGINATION_STRATEGY = 'offset-query'
export const EXTRACTION_STRATEGY =
  'verified-official-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api'
export const PARSER = 'custom-script'
export const NORMALIZATION_PROFILE = 'engineering-default'
export const CORPORATE_CAREERS_URL = 'https://www.jpmorganchase.com/careers'
export const CANDIDATE_EXPERIENCE_URL =
  'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions'
export const LISTING_API_BASE_URL =
  'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const DETAIL_API_BASE_URL =
  'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
export const PUBLIC_JOBS_BASE_URL =
  'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/'
export const SITE_NUMBER = 'CX_1001'
export const DEFAULT_LOCATION = 'India'
export const DEFAULT_LIMIT = 24

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CORPORATE_TITLE_PATTERN = /<title>\s*Careers\s*\|\s*JPMorganChase\s*<\/title>/i
const CORPORATE_CANONICAL_PATTERN =
  /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.jpmorganchase\.com\/careers\/?["']/i
const CORPORATE_JOIN_TEAM_PATTERN =
  /href=["']https:\/\/jpmc\.fa\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_1001\/requisitions["'][^>]*>/i
const CANDIDATE_TITLE_PATTERN = /<title>\s*JPMC Candidate Experience page\s*<\/title>/i
const CANDIDATE_BASE_PATTERN =
  /<base[^>]+href=["']\/hcmUI\/CandidateExperience\/en\/sites\/CX_1001["'][^>]+data-apibaseurl=["']https:\/\/jpmc\.fa\.oraclecloud\.com:443["'][^>]+data-sitenumber=["']CX_1001["']/i
const EXPERIENCE_PATTERN =
  /\b(\d+\+?\s*(?:-\s*\d+)?\s*years?(?:\s+applied experience)?)\b/i

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

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

const isIndiaPrimaryLocation = (record = {}) => {
  const country = normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase()
  const primaryLocation = normalizeWhitespace(record.PrimaryLocation)
  return country === 'IN' || /(?:^|,)\s*india\s*$/i.test(primaryLocation || '')
}
const indiaSecondaryLocation = (record = {}) => Array.isArray(record.secondaryLocations)
  ? record.secondaryLocations.find(location => normalizeWhitespace(location?.CountryCode)?.toUpperCase() === 'IN'
    || /(?:^|,)\s*india\s*$/i.test(normalizeWhitespace(location?.Name) || '')) : null
const isIndiaJob = (record = {}) => isIndiaPrimaryLocation(record) || Boolean(indiaSecondaryLocation(record))
const getEffectiveLocation = (record = {}) => normalizeLocation(
  isIndiaPrimaryLocation(record) ? record.PrimaryLocation : indiaSecondaryLocation(record)?.Name,
)

const extractPreferredQualification = (html) => {
  const heading = 'Preferred Qualifications, capabilities and skills'
  const pattern = new RegExp(
    `<strong>\\s*${escapeRegex(heading)}\\s*:?\\s*<\\/strong>\\s*<\\/p>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`,
    'i',
  )
  const sectionHtml = String(html ?? '').match(pattern)?.[1]
  if (!sectionHtml) return null

  const firstItem = sectionHtml.match(/<li[^>]*>([\s\S]*?)<\/li>/i)?.[1]
  return stripTags(firstItem)
}

const extractExperienceRequired = (...values) => {
  const text = normalizeWhitespace(values.filter(Boolean).join(' '))
  if (!text) return null

  return text.match(EXPERIENCE_PATTERN)?.[1] ?? null
}

const toListing = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const location = getEffectiveLocation(record)
  const sourceUrl = jobId ? buildJobDetailUrl(jobId) : null

  return {
    title: normalizeWhitespace(record.Title),
    company: COMPANY_NAME,
    department: normalizeWhitespace(record.Department || record.JobFunction || record.JobFamily || record.Category),
    location,
    city: extractCity(location),
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(record),
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
    remoteStatus: null,
    siteNumber: SITE_NUMBER,
  }
}

export const hasOfficialCorporateCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return CORPORATE_TITLE_PATTERN.test(page)
    && CORPORATE_CANONICAL_PATTERN.test(page)
    && CORPORATE_JOIN_TEAM_PATTERN.test(page)
    && /Join our team/i.test(text || '')
    && /Explore opportunities/i.test(text || '')
    && /Equal Opportunity Employer/i.test(text || '')
}

export const hasOfficialCandidateExperienceSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return CANDIDATE_TITLE_PATTERN.test(page)
    && CANDIDATE_BASE_PATTERN.test(page)
    && /Careers at Chase/i.test(text || '')
    && /\bGLOBAL\b/i.test(text || '')
    && /equal opportunity employer/i.test(text || '')
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
  const minimumQualification = normalizeWhitespace(detail.StudyLevel || detail.ExternalQualificationsStr)
    || listing.minimumQualification
    || null
  const description = joinDescriptionParts(
    detail.ExternalDescriptionStr,
    detail.CorporateDescriptionStr,
    detail.OrganizationDescriptionStr,
    detail.ShortDescriptionStr,
    detail.ExternalResponsibilitiesStr,
    detail.ExternalQualificationsStr,
  ) || listing.jobDescription || null
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const sourceUrl = listing.sourceUrl || buildJobDetailUrl(jobId)

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: COMPANY_NAME,
    department: normalizeWhitespace(
      detail.Department || detail.JobFunction || detail.JobFamily || detail.Category || detail.BusinessUnit,
    ) || listing.department || null,
    location,
    city: extractCity(location) || listing.city || null,
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired: extractExperienceRequired(minimumQualification, description) || listing.experienceRequired || null,
    minimumQualification,
    preferredQualification: extractPreferredQualification(detail.ExternalDescriptionStr) || listing.preferredQualification || null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill))
        .filter(Boolean)
      : listing.requiredSkills || [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeDate(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription: description,
    remoteStatus: null,
    siteNumber: SITE_NUMBER,
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

export const createChaseIndiaScraper = ({
  maxPages = Infinity,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
  signal,
} = {}) => ({
  async run() {
    signal?.throwIfAborted()
    const corporateCareersHtml = await fetchText(CORPORATE_CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCorporateCareersSignal(corporateCareersHtml)) {
      throw new Error('Chase India verified official JPMorgan careers page no longer matches the known first-party handoff')
    }

    const candidateExperienceHtml = await fetchText(CANDIDATE_EXPERIENCE_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCandidateExperienceSignal(candidateExperienceHtml)) {
      throw new Error('Chase India verified JPMC candidate experience page no longer matches the known first-party shell')
    }

    const jobs = await collectOracleRequisitionJobs({
      source: SOURCE, siteNumber: SITE_NUMBER, buildSearchUrl, buildJobDetailApiUrl,
      extractSearchResults, extractJobDetail, maxPages, maxJobs, signal, fetchJson,
    })
    for (const job of jobs) Object.assign(job, {
      scrapedAt: now(), companyCareerPage: CORPORATE_CAREERS_URL,
      companyDomain: COMPANY_DOMAIN, atsPlatform: ATS_PLATFORM,
    })
    return jobs
  },
})

export const run = async (options = {}) => createChaseIndiaScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Chase India scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
  }
}
