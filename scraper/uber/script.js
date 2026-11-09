import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const API_BASE_URL = 'https://iaziqy.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const PUBLIC_CAREERS_BASE_URL = 'https://iaziqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/'
export const SITE_NUMBER = 'CX_1'
export const DEFAULT_LOCATION = 'India'
export const DEFAULT_LIMIT = 24

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
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

const toJob = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const location = getLocation(record)
  const detailUrl = jobId ? buildJobDetailUrl(jobId) : null

  return {
    title: normalizeWhitespace(record.Title),
    company: 'Uber',
    department: normalizeWhitespace(record.Organization || record.Department || record.JobFunction || record.JobFamily),
    location,
    city: location?.split(',')[0] || null,
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeWhitespace(record.JobSchedule || record.JobType || record.WorkerType || record.ContractType),
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(record.StudyLevel || record.ExternalQualificationsStr),
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

export const createUberScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchJson = defaultFetchJson,
} = {}) => ({
  async run() {
    const jobs = []

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ page }))
      const pageJobs = extractSearchResults(payload)
      jobs.push(...pageJobs)

      const result = payload?.items?.[0] || {}
      const limit = Number(result.Limit) || DEFAULT_LIMIT
      const totalCount = Number(result.TotalJobsCount)
      if (pageJobs.length < limit || (Number.isFinite(totalCount) && (page + 1) * limit >= totalCount)) break
      if (maxJobs && jobs.length >= maxJobs) break
    }

    return (maxJobs ? jobs.slice(0, maxJobs) : jobs).map((job) => ({
      ...job,
      source: 'uber',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createUberScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Uber scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'uber')
    console.log('DB result:', result)
  }
}
