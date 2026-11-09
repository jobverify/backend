import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createProvidenceScraper } from './currentIndia20261108.js'
export { createProvidenceScraper }

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://providence.jobs/jobs/'
export const API_BASE_URL = 'https://prod-search-api.jobsyn.org/api/v1/solr/search'
export const APPLY_BASE_URL = 'https://evac.fa.us2.oraclecloud.com/fscmUI/faces/deeplink?objType=IRC_RECRUITING&action=ICE_JOB_DETAILS_RESP&objKey=pRequisitionNo='

const EXTERNAL_PROVIDER_BUID = 59189
const ORACLE_APPLY_BUID = 53254
const DEFAULT_PAGE_SIZE = 40
const REQUEST_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Origin': 'providence.jobs',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const normalizeLocationSlug = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['+:/]/g, '')
    .match(/[\w]+/g)
    ?.map((part) => part.toLowerCase())
    .join('-') || null
}

const buildLocation = (record = {}) => {
  const location = normalizeWhitespace(record.location_exact)
  const country = normalizeWhitespace(record.country_exact)
  if (!location || !country) return null
  return `${location}, ${country}`
}

export const buildSearchUrl = ({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => {
  const safePage = Math.max(1, toPositiveInteger(page) || 1)
  const safePageSize = toPositiveInteger(pageSize) || DEFAULT_PAGE_SIZE
  const offset = (safePage - 1) * safePageSize
  const query = new URLSearchParams({
    source: 'solr',
    'x-origin': 'providence.jobs',
    num_items: String(safePageSize),
    page: String(safePage),
    offset: String(offset),
    use_solr_filters: 'true',
  })

  return `${API_BASE_URL}?${query.toString()}`
}

export const buildJobUrl = (record = {}) => {
  const locationSlug = normalizeLocationSlug(record.location_exact)
  const titleSlug = normalizeWhitespace(record.title_slug)
  const guid = normalizeWhitespace(record.guid)

  if (!locationSlug || !titleSlug || !guid) return null

  return `https://providence.jobs/${locationSlug}/${titleSlug}/${guid}/job/`
}

export const buildApplyUrl = (record = {}) => {
  const buid = Number(record.buid)
  const reqid = normalizeWhitespace(record.reqid)
  const guid = normalizeWhitespace(record.guid)

  if (buid === ORACLE_APPLY_BUID && reqid) {
    return `${APPLY_BASE_URL}${encodeURIComponent(reqid)}`
  }

  if (buid === EXTERNAL_PROVIDER_BUID && guid) {
    return `https://rr.jobsyn.org/${guid}10`
  }

  return buildJobUrl(record)
}

export const extractPaginationSummary = (payload = {}) => {
  const page = toPositiveInteger(payload?.pagination?.page) || 1
  const pageSize = toPositiveInteger(payload?.pagination?.page_size) || 0
  const totalPages = toPositiveInteger(payload?.pagination?.total_pages) || page

  return {
    page,
    pageSize,
    totalPages,
    hasMore: payload?.pagination?.has_more_pages === true || page < totalPages,
  }
}

export const extractSearchResults = (payload = {}) =>
  (Array.isArray(payload.jobs) ? payload.jobs : [])
    .map((record) => {
      const title = normalizeWhitespace(record.title_exact)
      const company = normalizeWhitespace(record.company_exact)
      const department = normalizeWhitespace(record.job_category)
      const location = buildLocation(record)
      const city = normalizeWhitespace(record.city_exact)
      const state = normalizeWhitespace(record.state_short_exact)
      const country = normalizeWhitespace(record.country_exact)
      const guid = normalizeWhitespace(record.guid)
      const requisitionId = normalizeWhitespace(record.reqid)
      const sourceUrl = buildJobUrl(record)
      const applyUrl = buildApplyUrl(record)
      const jobDescription = normalizeWhitespace(record.description)
      if (!title || !company || !location || !guid || !sourceUrl || !applyUrl) {
        return null
      }

      return {
        title,
        company,
        department,
        location,
        city,
        state,
        country,
        jobId: guid,
        requisitionId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeWhitespace(record.job_type),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.date_updated || record.date_added),
        closingDate: null,
        jobDescription,
      }
    })
    .filter(Boolean)

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createProvidenceSolrScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ page, pageSize }), {
        headers: REQUEST_HEADERS,
      })
      const pageJobs = extractSearchResults(payload)
      const summary = extractPaginationSummary(payload)

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)

        jobs.push({
          ...job,
          source: 'providence',
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasMore) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createProvidenceScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'providence')
}
