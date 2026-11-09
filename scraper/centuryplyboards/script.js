import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'centuryplyboards'
export const COMPANY = 'Century Plyboards'
export const CAREERS_URL = 'https://www.centuryply.com/careers'
export const X0PA_ORIGIN = 'https://centuryply.x0pa.ai'
export const MICROSITE_ID = 'centuryplycareers'
export const DEFAULT_PAGE_SIZE = 10

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const getCustomFieldValue = (fields, key) => {
  if (!fields || typeof fields !== 'object') return null
  return normalizeWhitespace(fields[key] || fields[key?.toLowerCase?.()] || null)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>[\s\S]*Careers[\s\S]*Century[\s\S]*<\/title>/i.test(page)
    && /https:\/\/centuryply\.x0pa\.ai\/public\/microsites\/centuryplycareers/i.test(page)
    && /opportunities/i.test(text)
}

export const buildListingApiUrl = ({ skip = 0, limit = DEFAULT_PAGE_SIZE } = {}) => {
  const url = new URL(`/roboroy/api/v2/microsite/mst/${MICROSITE_ID}/jobs`, X0PA_ORIGIN)
  url.searchParams.set('skip', String(skip))
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('orderKey', 'open_date:desc')
  return url.toString()
}

export const buildDetailApiUrl = (jobId) => {
  const url = new URL(`/roboroy/api/v1/jobs/${jobId}`, X0PA_ORIGIN)
  url.searchParams.set('jobId', String(jobId))
  return url.toString()
}

export const buildPublicJobUrl = (jobId) => {
  const url = new URL(`/public/r/job/${jobId}`, X0PA_ORIGIN)
  url.searchParams.set('micrositeId', MICROSITE_ID)
  return url.toString()
}

export const extractSearchResults = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .map((record) => {
    const jobId = normalizeWhitespace(record.id)
    const location = normalizeLocation(record.location)
    if (!jobId || !location) return null

    const customFields = record.customJobFields || {}

    return {
      title: normalizeWhitespace(record.job_title),
      company: COMPANY,
      department: getCustomFieldValue(customFields, 'Department'),
      location,
      city: normalizeWhitespace(record.location),
      state: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: buildPublicJobUrl(jobId),
      applyUrl: buildPublicJobUrl(jobId),
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizePostingDate(record.open_date),
      closingDate: null,
      jobDescription: null,
      businessUnit: getCustomFieldValue(customFields, 'BusinessUnit'),
      branch: getCustomFieldValue(customFields, 'Branch'),
      category: getCustomFieldValue(customFields, 'Category'),
    }
  })
  .filter(Boolean)

export const extractJobDetail = (payload, baseJob = {}) => {
  const detail = payload?.data || payload || {}
  const customFields = detail.customJobFields || {}

  return {
    ...baseJob,
    title: normalizeWhitespace(detail.job_title) || baseJob.title || null,
    company: COMPANY,
    department: getCustomFieldValue(customFields, 'Department') || baseJob.department || null,
    location: normalizeLocation(detail.location) || baseJob.location || null,
    city: normalizeWhitespace(detail.location) || baseJob.city || null,
    state: null,
    country: 'India',
    jobId: baseJob.jobId || normalizeWhitespace(detail.id),
    requisitionId: baseJob.requisitionId || normalizeWhitespace(detail.id),
    sourceUrl: baseJob.sourceUrl || buildPublicJobUrl(detail.id),
    applyUrl: baseJob.applyUrl || buildPublicJobUrl(detail.id),
    employmentType: null,
    experienceRequired: normalizeWhitespace(detail.experience) || baseJob.experienceRequired || null,
    minimumQualification: normalizeWhitespace(detail.jobRequirement) || baseJob.minimumQualification || null,
    preferredQualification: baseJob.preferredQualification || null,
    requiredSkills: baseJob.requiredSkills || [],
    postingDate: baseJob.postingDate || null,
    closingDate: baseJob.closingDate || null,
    jobDescription: stripTags(detail.jobDesc) || baseJob.jobDescription || null,
    businessUnit: getCustomFieldValue(customFields, 'BusinessUnit') || baseJob.businessUnit || null,
    branch: getCustomFieldValue(customFields, 'Branch') || baseJob.branch || null,
    category: getCustomFieldValue(customFields, 'Category') || baseJob.category || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createCenturyPlyboardsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Century Plyboards careers page no longer matches the verified official handoff surface')
    }

    const jobs = []
    let skip = 0
    let total = Number.POSITIVE_INFINITY

    while (skip < total) {
      const listingPayload = await fetchJson(buildListingApiUrl({ skip, limit: pageSize }))
      const listings = extractSearchResults(listingPayload)
      total = Number(listingPayload?.count) || 0

      for (const listing of listings) {
        const detailPayload = await fetchJson(buildDetailApiUrl(listing.jobId))
        const detail = extractJobDetail(detailPayload, listing)
        jobs.push({
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (listings.length === 0) break
      skip += pageSize
    }

    return jobs
  },
})

export const run = async (options = {}) => createCenturyPlyboardsScraper().run(options)

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
