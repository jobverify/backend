import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const API_BASE_URL = 'https://egug.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const DETAIL_API_BASE_URL = 'https://egug.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
export const PUBLIC_CAREERS_BASE_URL = 'https://careers.americanexpress.com/en/sites/CX_1/job/'
export const SITE_NUMBER = 'CX_1'
export const DEFAULT_LOCATION = 'India'
export const DEFAULT_LIMIT = 24

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
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
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+:/g, ':'),
)

const isIndiaLocation = (location) => /(?:^|,)\s*india\s*$/i.test(location || '')

const getIndiaSecondaryLocation = (record = {}) => record.secondaryLocations
  ?.find((location) => location?.CountryCode === 'IN' || isIndiaLocation(location?.Name))
  ?.Name || null

const isIndiaJob = (record = {}) =>
  normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase() === 'IN'
  || isIndiaLocation(record.PrimaryLocation)
  || Boolean(getIndiaSecondaryLocation(record))

const getLocation = (record = {}) => normalizeWhitespace(
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

export const buildSearchUrl = ({
  page = 0,
  limit = DEFAULT_LIMIT,
  location = DEFAULT_LOCATION,
} = {}) => {
  const normalizedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit

  return `${API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${normalizedLimit},offset=${offset},location=${location}`
}

export const buildJobDetailUrl = (jobId) => `${PUBLIC_CAREERS_BASE_URL}${jobId}`
export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}/${encodeURIComponent(normalizeWhitespace(jobId) || '')}?expand=all`

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const extractExperienceRequired = ({
  title,
  minimumQualification,
  jobDescription,
}) => (
  extractJobFilterSignals({
    title,
    minimumQualification,
    jobDescription,
    experienceRequired: null,
  }).experienceProfile?.evidence || null
)

const toJob = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const location = getLocation(record)
  const detailUrl = jobId ? buildJobDetailUrl(jobId) : null

  return {
    title: normalizeWhitespace(record.Title),
    company: 'American Express',
    department: normalizeWhitespace(record.Organization || record.Department || record.JobFunction || record.JobFamily),
    location,
    city: location?.split(',')[0]?.trim() || null,
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeWhitespace(record.JobSchedule || record.JobType || record.WorkerType || record.ContractType),
    experienceRequired: null,
    minimumQualification: stripTags(record.StudyLevel || record.ExternalQualificationsStr),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(record.PostedDate),
    closingDate: normalizeWhitespace(record.PostingEndDate),
    jobDescription: normalizeWhitespace(
      [record.ShortDescriptionStr, record.ExternalResponsibilitiesStr].filter(Boolean).join(' '),
    ),
  }
}

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter(isIndiaJob)
  .map(toJob)
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractJobDetail = (payload, listing = {}) => {
  const detail = getRequisitionDetail(payload)
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const location = getLocation(detail) || listing.location || null
  const minimumQualification =
    stripTags(detail.StudyLevel || detail.ExternalQualificationsStr)
    || listing.minimumQualification
    || null
  const jobDescription = joinDescriptionParts(
    detail.ExternalDescriptionStr,
    detail.ShortDescriptionStr,
    detail.ExternalResponsibilitiesStr,
    detail.ExternalQualificationsStr,
  ) || listing.jobDescription || null
  const detailUrl = jobId ? buildJobDetailUrl(jobId) : listing.sourceUrl || listing.applyUrl || null

  return {
    title: normalizeWhitespace(detail.Title) || listing.title || null,
    company: 'American Express',
    department: normalizeWhitespace(
      detail.Organization || detail.Department || detail.JobFunction || detail.JobFamily || detail.Category,
    ) || listing.department || null,
    location,
    city: location?.split(',')[0]?.trim() || listing.city || null,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeWhitespace(
      detail.JobSchedule || detail.JobType || detail.WorkerType || detail.ContractType || detail.RequisitionType,
    ) || listing.employmentType || null,
    experienceRequired: extractExperienceRequired({
      title: normalizeWhitespace(detail.Title) || listing.title || null,
      minimumQualification,
      jobDescription,
    }) || listing.experienceRequired || null,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeWhitespace(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription,
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createAmericanExpressScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchJson = defaultFetchJson,
} = {}) => ({
  async run() {
    const jobs = []

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ page }))
      const pageJobs = extractSearchResults(payload)

      for (const listing of pageJobs) {
        let detail = listing

        try {
          const detailPayload = await fetchJson(buildJobDetailApiUrl(listing.jobId))
          detail = extractJobDetail(detailPayload, listing)
        } catch {
          detail = listing
        }

        jobs.push({
          ...detail,
          source: 'americanexpress',
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      const result = payload?.items?.[0] || {}
      const limit = Number(result.Limit) || DEFAULT_LIMIT
      const totalCount = Number(result.TotalJobsCount)
      if (pageJobs.length < limit || (Number.isFinite(totalCount) && (page + 1) * limit >= totalCount)) break
    }

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createAmericanExpressScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running American Express scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'americanexpress')
    console.log('DB result:', result)
  }
}
