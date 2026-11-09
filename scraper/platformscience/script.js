import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import PLATFORM_SCIENCE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PLATFORM_SCIENCE_CATALOG.source
export const COMPANY = PLATFORM_SCIENCE_CATALOG.companyName
export const CAREERS_URL = PLATFORM_SCIENCE_CATALOG.companyCareerPage
export const GREENHOUSE_BOARD_URL = 'https://job-boards.greenhouse.io/platformscience'
export const GREENHOUSE_API_URL = 'https://boards-api.greenhouse.io/v1/boards/platformscience/jobs?content=true'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtml = (value) => normalizeWhitespace(value)

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
    Referer: CAREERS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const pageIndicatesOfficialJobsSurface = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  if (
    /\bOpen Positions\b/i.test(normalized)
    && /platformscience\.com\/careers\?gh_jid=/i.test(page)
    && /\bContact Us\b/i.test(normalized)
    && /greenhouse\.io\/platformscience/i.test(page)
  ) return true

  return /<title>\s*Open Jobs at Platform Science \| Technology &amp; Fleet Innovation Careers\s*<\/title>/i.test(page)
    && /open positions/i.test(normalized)
    && /contact us/i.test(normalized)
    && /fleet tech innovation/i.test(normalized)
    && /boards\.greenhouse\.io/i.test(page)
  }

const metadataIncludesIndia = (metadata = []) =>
  (Array.isArray(metadata) ? metadata : []).some((entry) =>
    /country/i.test(String(entry?.name ?? ''))
    && String(entry?.value ?? '').includes('India'))

export const isIndiaJob = (job = {}) => {
  const locationText = [
    job?.location?.name,
    ...(Array.isArray(job?.offices) ? job.offices.map((office) => office?.location ?? office?.name) : []),
  ]
    .filter(Boolean)
    .join(' ')

  return /india/i.test(locationText) || metadataIncludesIndia(job.metadata)
}

const inferCity = (locationName) => normalizeWhitespace(String(locationName ?? '').split(',')[0]) || null

const mapJob = (job = {}) => {
  const location = normalizeWhitespace(job?.location?.name)
  const sourceUrl = normalizeWhitespace(job?.absolute_url)
  const title = normalizeWhitespace(job?.title)

  if (!title || !location || !sourceUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job?.departments?.[0]?.name),
    location,
    city: inferCity(location),
    country: 'India',
    jobId: String(job?.id ?? ''),
    requisitionId: normalizeWhitespace(job?.requisition_id),
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    // Greenhouse's first_published timestamp can predate an active repost by years.
    postingDate: null,
    closingDate: null,
    jobDescription: decodeHtml(job?.content),
  }
}

export const extractJobsFromGreenhousePayload = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter(isIndiaJob)
    .map(mapJob)
    .filter(Boolean)

export const createPlatformScienceScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!pageIndicatesOfficialJobsSurface(careersHtml)) {
      throw new Error('Platform Science jobs page no longer matches the verified first-party public surface')
    }

    const payload = await fetchJson(GREENHOUSE_API_URL)
    const jobs = extractJobsFromGreenhousePayload(payload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createPlatformScienceScraper().run(options)

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
