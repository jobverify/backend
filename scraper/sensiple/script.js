import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SENSIPLE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SENSIPLE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'X-Requested-With': 'XMLHttpRequest',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const formatLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || normalized
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Sensiple\s*\|\s*Join Our Team of Innovators\s*<\/title>/i.test(page)
    && /Current Openings/i.test(page)
    && /Loading jobs/i.test(page)
    && /get_jobs_secure/i.test(page)
}

export const extractJobsApiUrl = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(/fetch\(\s*(['"])([^'"]*admin-ajax\.php\?action=get_jobs_secure)\1/i)?.[2],
  )

export const normalizeJobPayload = (job = {}, { scrapedAt } = {}) => {
  const jobId = normalizeWhitespace(job?.ReqIntID)
  const title = normalizeWhitespace(job?.JobTitle)
  const requisitionId = normalizeWhitespace(job?.ReqID)
  const description = stripTags(job?.Description)

  if (!jobId || !title || !requisitionId) {
    return null
  }

  const sourceUrl = `${CAREERS_URL}#${jobId}`

  return {
    jobId,
    title,
    company: COMPANY,
    department: null,
    location: formatLocation(job?.Location),
    city: extractCity(job?.Location),
    country: 'India',
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: normalizeWhitespace(job?.TotalExp),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: normalizeWhitespace(job?.PrimarySkills)
      ?.split(',')
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean) || [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    requisitionId,
    source: SOURCE,
    link: sourceUrl,
    scrapedAt,
  }
}

export const createSensipleScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Sensiple careers page no longer matches the trusted first-party surface')
    }

    const discoveredJobsApiUrl = extractJobsApiUrl(careersHtml)
    if (discoveredJobsApiUrl !== JOBS_API_URL) {
      throw new Error('The verified Sensiple careers page no longer exposes the trusted jobs payload URL')
    }

    const payload = await fetchJson(JOBS_API_URL)
    if (!payload?.success || !Array.isArray(payload?.data)) {
      throw new Error('The verified Sensiple jobs payload no longer matches the trusted first-party contract')
    }

    const scrapedAt = now()
    return payload.data
      .filter((job) => normalizeWhitespace(job?.Status) === 'Active')
      .map((job) => normalizeJobPayload(job, { scrapedAt }))
      .filter(Boolean)
      .map((job) => ({
        ...job,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'sensiple.com',
        atsPlatform: 'official-company-careers',
      }))
  },
})

export const run = async (options = {}) => createSensipleScraper(options).run(options)

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
