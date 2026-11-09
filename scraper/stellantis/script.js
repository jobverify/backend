import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://careers.stellantis.com/'
export const SEARCH_PAGE_URL = 'https://careers.stellantis.com/job-search-results/'
export const SEARCH_API_URL = 'https://jobsapi-google.m-cloud.io/api/job/search'
export const COMPANY_QUERY_VALUE = 'companies/16115603-6c1b-4c45-b544-238a4e6c51b3'
export const PAGE_SIZE = 10

const COMPANY = 'Stellantis'
const SOURCE = 'stellantis'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeString = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const slugify = (value) => normalizeString(value)
  ?.toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeCountry = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null

  const uppercase = normalized.toUpperCase()
  if (uppercase === 'IN' || uppercase === 'IND' || uppercase === 'INDIA') return 'India'

  return normalized
}

const joinLocation = ({ city, state, country }) =>
  [city, state, country].filter(Boolean).join(', ') || null

const extractSlugFromUrl = (value) => {
  const match = normalizeString(value)?.match(/\/job\/[^/]+\/([^/]+)\/?$/i)
  return match?.[1] || null
}

const buildFallbackSlug = (job = {}) => {
  const slugParts = [
    slugify(job.title),
    slugify(job.primary_city),
    slugify(job.primary_state),
  ].filter(Boolean)

  return slugParts.length > 0 ? slugParts.join('-') : null
}

export const buildDetailUrl = ({ jobId, slug }) => {
  if (!jobId || !slug) return null
  return `${CAREER_PAGE_URL}job/${encodeURIComponent(jobId)}/${encodeURIComponent(slug)}/`
}

export const buildSearchUrl = ({ pageToken = null, limit = PAGE_SIZE } = {}) => {
  const url = new URL(SEARCH_API_URL)

  url.searchParams.set('CompanyName', COMPANY_QUERY_VALUE)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('sortfield', 'open_date')
  url.searchParams.set('sortorder', 'descending')

  if (pageToken) url.searchParams.set('pageToken', pageToken)

  return url.toString()
}

const normalizeListing = (entry = {}) => {
  const job = entry?.job || {}
  const jobId = normalizeString(job.id)
  const title = normalizeString(job.title)
  const city = normalizeString(job.primary_city || job.google_locations?.[0]?.city)
  const state = normalizeString(job.primary_state || job.google_locations?.[0]?.state)
  const country = normalizeCountry(job.primary_country || job.google_locations?.[0]?.country)
  const location = joinLocation({ city, state, country })
  const slug = extractSlugFromUrl(job.url) || buildFallbackSlug(job)
  const sourceUrl = normalizeString(job.url) || buildDetailUrl({ jobId, slug })
  const applyUrl = normalizeString(job.seo_url) || sourceUrl

  if (!jobId || !title || !location || !sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeString(job.department),
    location,
    city,
    state,
    country,
    locations: [
      normalizeString(job.primary_address),
      normalizeString(job.location_type),
      ...((Array.isArray(job.google_locations) ? job.google_locations : []).map((item) => normalizeString(item?.address))),
    ].filter(Boolean),
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: normalizeString(job.employment_type),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeString(job.open_date),
    closingDate: normalizeString(job.close_date),
    jobDescription: normalizeString(job.description) || normalizeString(entry?.summary?.job_summary),
  }
}

export const extractSearchSummary = (payload = {}) => ({
  totalJobCount: Number.isFinite(payload?.totalHits) ? payload.totalHits : null,
  nextPageToken: normalizeString(payload?.nextPageToken),
  pageSize: Array.isArray(payload?.searchResults) ? payload.searchResults.length : 0,
})

export const extractSearchResults = (payload = {}) =>
  filterIndiaJobs(
    (Array.isArray(payload?.searchResults) ? payload.searchResults : [])
      .map(normalizeListing)
      .filter(Boolean),
  ).map(({ locations, ...job }) => job)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  },
  label: 'stellantis',
  timeoutMs: 15000,
})

export const createStellantisScraper = () => ({
  async run({
    fetchJson = defaultFetchJson,
    maxPages = Number.POSITIVE_INFINITY,
    maxJobs = null,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()
    let pageToken = null

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ pageToken }))
      const listings = extractSearchResults(payload)
      const summary = extractSearchSummary(payload)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        jobs.push({
          ...listing,
          source: SOURCE,
          link: listing.applyUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      if (!summary.nextPageToken || summary.pageSize === 0) break
      pageToken = summary.nextPageToken
    }

    return jobs
  },
})

export const run = async (options = {}) => createStellantisScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
