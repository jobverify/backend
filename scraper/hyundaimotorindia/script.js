import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.hyundai.co.in'
export const SEARCH_PAGE_URL = `${BASE_URL}/search/?createNewAlert=false&q=&locationsearch=`
export const SEARCH_API_URL = `${BASE_URL}/services/recruiting/v1/jobs`
const DEFAULT_LOCALE = 'en_US'

const COMPANY_NAME = 'Hyundai Motor India'
const SOURCE = 'hyundaimotorindia'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/<br\s*\/?>/gi, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const slugifyTitle = (value) => normalizeWhitespace(value)
  ?.replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '') || 'untitled'

const normalizeLocationArray = (values) => unique(
  (Array.isArray(values) ? values : [])
    .map((value) => normalizeWhitespace(value)?.split(',')[0]?.trim() || null)
    .filter(Boolean),
)

const joinLocations = (locations) => {
  const normalized = normalizeLocationArray(locations)
  return normalized.length > 0 ? `${normalized.join(', ')}, India` : null
}

export const buildSearchRequestPayload = (pageNumber = 0) => ({
  keywords: '',
  locale: DEFAULT_LOCALE,
  pageNumber,
  sortBy: 'recent',
})

export const buildDetailUrl = (title, jobId) =>
  `${BASE_URL}/job/${slugifyTitle(title)}/${normalizeWhitespace(jobId) || ''}/`

export const buildApplyUrl = (jobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/talentcommunity/apply/${normalizeWhitespace(jobId) || ''}/?locale=${locale}`

export const extractSearchSummary = (payload) => ({
  totalJobCount: Number.isFinite(payload?.totalJobs) ? payload.totalJobs : null,
  pageSize: Array.isArray(payload?.jobSearchResult) ? payload.jobSearchResult.length : 0,
})

export const extractSearchResults = (payload) => {
  if (!Array.isArray(payload?.jobSearchResult)) return []

  return payload.jobSearchResult
    .map((entry) => entry?.response || null)
    .filter(Boolean)
    .map((record) => {
      const title = normalizeWhitespace(record.unifiedStandardTitle)
      const jobId = normalizeWhitespace(record.id)
      const location = joinLocations(record.sfstd_jobLocation_obj || record.jobLocationShort)
      const city = normalizeLocationArray(record.sfstd_jobLocation_obj || record.jobLocationShort)[0] || null

      if (!title || !jobId || !location) return null

      return {
        title,
        location,
        city,
        state: null,
        jobId,
        requisitionId: jobId,
        sourceUrl: buildDetailUrl(record.unifiedUrlTitle || record.urlTitle || title, jobId),
        applyUrl: buildApplyUrl(jobId),
        postingDate: normalizeWhitespace(record.unifiedStandardStart),
        closingDate: normalizeWhitespace(record.unifiedStandardEnd),
      }
    })
    .filter(Boolean)
  }

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      ...(options.headers || {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createHyundaiMotorIndiaScraper = () => ({
  async run({
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()

    for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
      const payload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        body: JSON.stringify(buildSearchRequestPayload(pageNumber)),
      })
      const listings = extractSearchResults(payload)
      const summary = extractSearchSummary(payload)

      if (listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        jobs.push({
          ...listing,
          company: COMPANY_NAME,
          link: listing.applyUrl || listing.sourceUrl,
          source: SOURCE,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      const totalJobCount = summary.totalJobCount || 0
      const pageSize = summary.pageSize || listings.length
      if ((pageNumber + 1) * pageSize >= totalJobCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createHyundaiMotorIndiaScraper().run(options)
