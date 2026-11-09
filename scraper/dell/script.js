import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const API_BASE_URL = 'https://iawmqy.fa.ocs.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
const PUBLIC_CAREERS_BASE_URL = 'https://jobs.dell.com/en/sites/careers/job/'
const SITE_NUMBER = 'CX_1001'
const DEFAULT_LOCATION = 'India'
const DEFAULT_LIMIT = 24

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

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

  return normalized
    .split(',')
    .map((part) => toTitleCase(part))
    .filter(Boolean)
    .join(', ')
}

const extractCity = (location) => normalizeLocation(location)?.split(',')[0] || null

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => normalizeWhitespace(part))
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

const isIndiaJob = (record = {}) => {
  const country = normalizeWhitespace(record.PrimaryLocationCountry)?.toUpperCase()
  const location = normalizeWhitespace(record.PrimaryLocation)?.toLowerCase()

  return country === 'IN' || location?.endsWith('india') || false
}

const toJob = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const detailUrl = jobId ? buildJobDetailUrl(jobId) : null

  return {
    title: normalizeWhitespace(record.Title),
    company: 'Dell Technologies',
    department: normalizeWhitespace(record.Department || record.JobFunction || record.JobFamily),
    location: normalizeLocation(record.PrimaryLocation),
    city: extractCity(record.PrimaryLocation),
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(record.StudyLevel || record.ExternalQualificationsStr),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(record.PostedDate),
    closingDate: normalizeWhitespace(record.PostingEndDate),
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
  const resolvedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * resolvedLimit

  return `${API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${resolvedLimit},offset=${offset},location=${location}`
}

export const buildJobDetailUrl = (jobId) => `${PUBLIC_CAREERS_BASE_URL}${jobId}/`

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => toJob(record))

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const run = async () => {
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1
  const maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null
  const jobs = []

  for (let page = 0; page < maxPages; page += 1) {
    const payload = await fetchJson(buildSearchUrl({ page }))
    const pageJobs = extractSearchResults(payload)

    jobs.push(...pageJobs)

    const totalCount = Number(payload?.items?.[0]?.TotalJobsCount)
    const limit = Number(payload?.items?.[0]?.Limit) || DEFAULT_LIMIT
    const nextOffset = (page + 1) * limit

    if (pageJobs.length < limit || (Number.isFinite(totalCount) && nextOffset >= totalCount)) {
      break
    }

    if (maxJobs && jobs.length >= maxJobs) {
      break
    }
  }

  const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

  return selectedJobs.map((job) => ({
    ...job,
    source: 'dell',
    link: job.applyUrl || job.sourceUrl,
    scrapedAt: new Date().toISOString(),
  }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Dell scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'dell')
    console.log('DB result:', result)
    process.exit(0)
  }
}
