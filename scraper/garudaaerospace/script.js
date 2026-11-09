import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://www.garudaaerospace.com/company/careers'
export const LISTINGS_API_URL = 'https://server.garudaaerospace.com/career'

const COMPANY = 'Garuda Aerospace'
const SOURCE = 'garudaaerospace'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, '\'')

const htmlToText = (value) => {
  const html = String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/p\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/li\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

  return normalizeWhitespace(decodeHtmlEntities(html))
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const isoDate = /^(\d{4}-\d{2}-\d{2})/.exec(normalized)
  if (isoDate) return isoDate[1]

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const pickFirst = (record, keys) => {
  for (const key of keys) {
    const value = normalizeWhitespace(record?.[key])
    if (value) return value
  }

  return null
}

const getRecords = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.jobs)) return payload.jobs
  return []
}

const getRecord = (payload) => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload?.data)) {
    return payload.data ?? payload.job ?? payload
  }

  return payload
}

const summarizeRecord = (record = {}) => ({
  jobId: pickFirst(record, ['_id', 'id', 'jobId']),
  title: pickFirst(record, ['jobTitle', 'title', 'name']),
  department: pickFirst(record, ['department', 'jobDepartment', 'dept']),
  location: pickFirst(record, ['location', 'jobLocation', 'job_location', 'city']),
  employmentType: pickFirst(record, ['employmentType', 'type', 'jobType']),
  experienceRequired: pickFirst(record, ['experience', 'experienceRequired']),
  postingDate: normalizeDate(pickFirst(record, ['createdAt', 'updatedAt', 'postedAt', 'postingDate'])),
})

export const buildDetailApiUrl = (jobId) => `${LISTINGS_API_URL}/${normalizeWhitespace(jobId) || ''}`

export const buildApplyUrl = (jobId) =>
  `${CAREERS_URL}/apply/${normalizeWhitespace(jobId) || ''}`

export const extractListings = (payload) => getRecords(payload)
  .map((record) => summarizeRecord(record))
  .filter((record) => record.jobId && record.title)

export const extractJobDetail = (payload) => {
  const record = getRecord(payload)
  const summary = summarizeRecord(record)
  const jobDescription = htmlToText(
    record?.jobDescription
      ?? record?.description
      ?? record?.jobDesc
      ?? record?.content,
  )

  return {
    title: summary.title,
    department: summary.department,
    location: summary.location,
    employmentType: summary.employmentType,
    experienceRequired: summary.experienceRequired,
    postingDate: summary.postingDate,
    jobDescription,
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
})

const toJob = (listing, detail, now) => {
  const merged = {
    ...listing,
    ...detail,
  }
  const jobId = merged.jobId
  const applyUrl = buildApplyUrl(jobId)
  const location = merged.location
  const city = location ? location.split(',')[0].trim() : null

  return {
    title: merged.title,
    company: COMPANY,
    department: merged.department,
    location,
    city: city || null,
    state: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: merged.employmentType,
    experienceRequired: merged.experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: merged.postingDate,
    closingDate: null,
    jobDescription: merged.jobDescription,
    source: SOURCE,
    link: applyUrl,
    scrapedAt: now(),
  }
}

export const createGarudaAerospaceScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const listings = extractListings(await fetchJson(LISTINGS_API_URL))
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detail = extractJobDetail(await fetchJson(buildDetailApiUrl(listing.jobId)))
      jobs.push(toJob(listing, detail, now))
    }

    return jobs
  },
})

export const run = async (options = {}) => createGarudaAerospaceScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Garuda Aerospace scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
