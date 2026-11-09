import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.hcltech.com'
const SEARCH_PAGE_URL = `${BASE_URL}/search/?q=&sortColumn=referencedate&sortDirection=desc`
const SEARCH_API_PATH = '/services/recruiting/v1/jobs'
const DEFAULT_LOCALE = 'en_US'
const REQUEST_TIMEOUT_MS = 30000

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2F;/gi, '/')
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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const createRequestSignal = (signal, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
}

const normalizeDetailSlug = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'untitled'
  if (/%[0-9a-f]{2}/i.test(normalized)) return normalized
  return normalized
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'untitled'
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractExperienceRequired = (value) => normalizeWhitespace(extractFirst(
  /(?:minimum\s+years?\s+of\s+experience|experience)\s*[-:]\s*([0-9]+\s*\+?\s*(?:to\s*\d+)?\s*years?)/i,
  value,
))

const isIndiaRecord = (record = {}) => {
  const countryHints = [
    ...(Array.isArray(record.jobLocationCountry) ? record.jobLocationCountry : []),
    ...(Array.isArray(record.custCountryRegion) ? record.custCountryRegion : []),
  ]
    .map(normalizeWhitespace)
    .filter(Boolean)

  if (countryHints.some((value) => /india/i.test(value))) return true

  const locationHints = [
    record.custprimecity,
    ...(Array.isArray(record.sfstd_jobLocation_obj) ? record.sfstd_jobLocation_obj : []),
    ...(Array.isArray(record.jobLocationShort) ? record.jobLocationShort : []),
  ]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join(' ')

  return /india/i.test(locationHints)
}

export const buildSearchRequestPayload = (pageNumber = 0) => ({
  keywords: 'India',
  locale: DEFAULT_LOCALE,
  pageNumber,
  sortBy: 'recent',
})

export const buildDetailUrl = (urlTitleOrTitle, jobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/job/${normalizeDetailSlug(urlTitleOrTitle)}/${jobId}-${locale}/`

export const buildApplyUrl = (jobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/talentcommunity/apply/${jobId}/?locale=${locale}&jobID=${jobId}#tracked`

export const normalizeEmploymentType = (title) => {
  const normalizedTitle = normalizeWhitespace(title)?.toLowerCase() || ''
  if (/intern|internship|co-op|apprentice/.test(normalizedTitle)) return 'Internship'
  if (/contract|contractor|freelance/.test(normalizedTitle)) return 'Contract'
  return 'Full-time'
}

export const extractSearchSummary = (payload) => ({
  totalJobCount: Number.isFinite(payload?.totalJobs) ? payload.totalJobs : null,
  pageSize: Array.isArray(payload?.jobSearchResult) ? payload.jobSearchResult.length : 0,
})

export const extractSearchResults = (payload) => {
  if (!Array.isArray(payload?.jobSearchResult)) return []

  return payload.jobSearchResult
    .map((entry) => entry?.response || null)
    .filter(Boolean)
    .filter(isIndiaRecord)
    .map((record) => {
      const title = normalizeWhitespace(record.unifiedStandardTitle)
      const jobId = normalizeWhitespace(record.id)
      const city = normalizeWhitespace(record.custprimecity) || null
      const location = city ? `${city}, India` : 'India'
      const state = unique(
        (Array.isArray(record.jobLocationState) ? record.jobLocationState : [])
          .map(normalizeWhitespace),
      ).join(', ') || null
      const urlTitle = normalizeWhitespace(record.unifiedUrlTitle || record.urlTitle || title)

      if (!title || !jobId) return null

      return {
        title,
        location,
        city,
        state,
        jobId,
        requisitionId: jobId,
        sourceUrl: buildDetailUrl(urlTitle || title, jobId),
        applyUrl: buildApplyUrl(jobId),
        postingDate: normalizeWhitespace(record.unifiedStandardStart),
        closingDate: normalizeWhitespace(record.unifiedStandardEnd),
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  )
  const jobDescription = stripTags(descriptionHtml)
  const requiredSkills = extractListItems(descriptionHtml)
  const jobId = normalizeWhitespace(
    extractFirst(/jobID\s*:\s*'?(\d+)'?/i, html),
  ) || listing.jobId || null
  const experienceRequired = extractExperienceRequired(jobDescription) || listing.experienceRequired || null
  const sourceUrl = listing.sourceUrl || (title && jobId ? buildDetailUrl(listing.urlTitle || title, jobId) : null)

  return {
    title,
    location: listing.location || 'India',
    city: listing.city || null,
    state: listing.state || null,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: normalizeEmploymentType(title),
    experienceRequired,
    jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: listing.postingDate || null,
    closingDate: listing.closingDate || null,
    applyUrl: buildApplyUrl(jobId),
    sourceUrl,
  }
}

const fetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    body: options.body,
    signal: createRequestSignal(options.signal),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const fetchSearchPageSession = async (signal) => {
  const response = await fetch(SEARCH_PAGE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createRequestSignal(signal),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${SEARCH_PAGE_URL}`)
  }

  const html = await response.text()
  const csrfToken = normalizeWhitespace(extractFirst(/"X-CSRF-Token"\s*:\s*"([^"]+)"/i, html))
  const cookieHeader = response.headers.getSetCookie
    ? response.headers.getSetCookie()
      .map((value) => value.split(';', 1)[0])
      .join('; ')
    : null

  if (!csrfToken) {
    throw new Error('Missing HCLTech search CSRF token')
  }

  return {
    csrfToken,
    cookieHeader,
  }
}

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json,text/plain,*/*',
      ...(options.headers || {}),
    },
    body: options.body,
    signal: createRequestSignal(options.signal),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const hydrateJobDetails = async (listings, {
  fetchDetail = fetchText,
  signal,
} = {}) => {
  const hydrated = []

  for (const listing of listings) {
    signal?.throwIfAborted()
    const detailHtml = await fetchDetail(listing.sourceUrl, { signal })
    signal?.throwIfAborted()
    hydrated.push({
      listing,
      detail: extractJobDetail(detailHtml, listing),
    })
  }

  return hydrated
}

export const run = async ({ signal } = {}) => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY
  const session = await fetchSearchPageSession(signal)

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    signal?.throwIfAborted()
    const listingPayload = await fetchJson(`${BASE_URL}${SEARCH_API_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': session.csrfToken,
        ...(session.cookieHeader ? { Cookie: session.cookieHeader } : {}),
      },
      body: JSON.stringify(buildSearchRequestPayload(pageNumber)),
      signal,
    })
    const listings = extractSearchResults(listingPayload)
    const summary = extractSearchSummary(listingPayload)

    if (listings.length === 0) break

    const freshListings = listings.filter((listing) => {
      if (seenJobIds.has(listing.jobId)) return false
      seenJobIds.add(listing.jobId)
      return true
    })

    const detailedListings = await hydrateJobDetails(freshListings, { signal })

    for (const { listing, detail } of detailedListings) {

      jobs.push({
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        title: detail.title || listing.title,
        company: 'HCLTech',
        department: null,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        state: detail.state || listing.state,
        link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
        applyUrl: detail.applyUrl || listing.applyUrl,
        sourceUrl: detail.sourceUrl || listing.sourceUrl,
        source: 'hcltech',
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        jobDescription: detail.jobDescription,
        minimumQualification: detail.minimumQualification,
        preferredQualification: detail.preferredQualification,
        requiredSkills: detail.requiredSkills,
        postingDate: detail.postingDate || listing.postingDate,
        closingDate: detail.closingDate || listing.closingDate,
        scrapedAt: new Date().toISOString(),
      })
    }

    const totalJobCount = summary.totalJobCount || 0
    const pageSize = summary.pageSize || listings.length
    if ((pageNumber + 1) * pageSize >= totalJobCount) break
  }

  signal?.throwIfAborted()
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running HCLTech scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'hcltech')
    console.log('DB result:', result)
    process.exit(0)
  }
}
