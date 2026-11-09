import path from 'path'
import { fileURLToPath } from 'url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://careers.textron.com/locations/ind/jobs/'
export const API_ENDPOINT = 'https://prod-search-api.jobsyn.org/api/v1/solr/search'
export const PAGE_SIZE = 10
export const REQUEST_HEADERS = {
  Accept: 'application/json',
  'X-Origin': 'careers.textron.com',
  Referer: CAREER_PAGE_URL,
  'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
}

const COMPANY = 'Textron'
const SOURCE = 'textron'
const SOURCE_QUERY = 'google_talent'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const slugifySegment = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const isIndiaJob = (job = {}) => {
  const country = normalizeWhitespace(job.country_exact)?.toLowerCase()
  const location = normalizeWhitespace(job.location_exact)?.toLowerCase() || ''

  return country === 'india' || /\bind\b/.test(location) || /\bindia\b/.test(location)
}

export const buildSearchUrl = ({
  page = 1,
  pageSize = PAGE_SIZE,
} = {}) => {
  const safePage = toPositiveInteger(page, 1)
  const safePageSize = toPositiveInteger(pageSize, PAGE_SIZE)
  const query = new URLSearchParams([
    ['page', String(safePage)],
    ['location', 'ind'],
    ['num_items', String(safePageSize)],
    ['source', SOURCE_QUERY],
    ['x-origin', 'careers.textron.com'],
    ['use_solr_filters', 'true'],
  ])

  return `${API_ENDPOINT}?${query.toString()}`
}

export const buildJobUrl = (job = {}) => {
  const locationSlug = slugifySegment(job.location_exact)
  const titleSlug = slugifySegment(job.title_slug)
  const guid = normalizeWhitespace(job.guid)

  if (!locationSlug || !titleSlug || !guid) return null

  return `https://careers.textron.com/${locationSlug}/${titleSlug}/${guid}/job/`
}

export const extractDescriptionMetadata = (description) => {
  const metadata = {}

  for (const rawLine of String(description || '').split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = line.match(/^\*\*([^:*]+):\*\*\s*(.+?)\s*$/)
    if (!match) continue

    metadata[match[1]] = normalizeWhitespace(match[2])
  }

  return metadata
}

const getRemoteStatus = (job = {}) =>
  Array.isArray(job.on_sites) && job.on_sites.includes(0) ? 'On-site' : null

export const mapTextronJob = (job = {}) => {
  if (!isIndiaJob(job)) return null

  const sourceUrl = buildJobUrl(job)
  if (!sourceUrl) return null

  const metadata = extractDescriptionMetadata(job.description)
  const location = normalizeWhitespace(job.location_exact)

  return {
    title: normalizeWhitespace(job.title_exact),
    company: COMPANY,
    department: normalizeWhitespace(job.job_category),
    location,
    city: normalizeWhitespace(job.city_exact) || location?.split(',')[0]?.trim() || null,
    country: normalizeWhitespace(job.country_exact) || 'India',
    jobId: normalizeWhitespace(job.guid),
    requisitionId: normalizeWhitespace(job.reqid),
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: metadata.Schedule || null,
    experienceRequired: metadata['Job Type'] || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job.date_new || job.date_updated),
    closingDate: null,
    jobDescription: job.description || null,
    remoteStatus: getRemoteStatus(job),
  }
}

const defaultFetchJson = (url, options = {}) =>
  fetchJsonWithRetry(url, {
    ...options,
    headers: {
      ...REQUEST_HEADERS,
      ...(options.headers || {}),
    },
    label: SOURCE,
  })

export const createTextronScraper = () => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const jobs = []
    let page = 1

    while (true) {
      const url = buildSearchUrl({ page })
      const payload = await fetchJson(url, { headers: REQUEST_HEADERS })
      const pageJobs = Array.isArray(payload?.jobs) ? payload.jobs : []

      jobs.push(
        ...pageJobs
          .map(mapTextronJob)
          .filter(Boolean)
          .map((job) => ({
            ...job,
            source: SOURCE,
            link: job.applyUrl,
            scrapedAt: new Date().toISOString(),
          })),
      )

      if (!payload?.pagination?.has_more_pages || pageJobs.length === 0) break
      page += 1
    }

    return jobs
  },
})

export const run = async () => createTextronScraper().run()

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
