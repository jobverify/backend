import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { URBAN_COMPANY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = URBAN_COMPANY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const KNOWN_INDIA_CITIES = new Set(Object.values(CANONICAL_CITIES))

export const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Urban Company\s*<\/title>/i.test(rawHtml)
    && /<div\b[^>]*id=["']root["'][^>]*>\s*<\/div>/i.test(rawHtml)
    && /static\/js\/main\.[a-z0-9]+\.chunk\.js/i.test(rawHtml)
}

const isIndiaLocation = (job = {}) => {
  const locations = Array.isArray(job.location) ? job.location : []
  const locationCities = Array.isArray(job.location_city) ? job.location_city : []
  const haystack = normalizeWhitespace([...locations, ...locationCities].join(' ')).toLowerCase()

  if (!haystack) return false
  if (haystack.includes('india')) return true

  return locationCities.some((city) => {
    const normalized = normalizeCity(city)
    return normalized != null && KNOWN_INDIA_CITIES.has(normalized)
  })
}

const inferRemoteStatus = (location = '') => {
  const normalized = normalizeWhitespace(location).toLowerCase()
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

const firstNonEmpty = (...values) =>
  values.map((value) => normalizeWhitespace(value)).find(Boolean) || null

const buildLocationLabel = (job = {}) => {
  const locations = Array.isArray(job.location) ? job.location.map((value) => normalizeWhitespace(value)).filter(Boolean) : []
  if (locations.length > 0) return locations[0]

  const cities = Array.isArray(job.location_city) ? job.location_city.map((value) => normalizeCity(value) || normalizeWhitespace(value)).filter(Boolean) : []
  return cities[0] ? `${cities[0]}, India` : null
}

export const mapUrbanCompanyJob = (job = {}) => {
  const title = normalizeWhitespace(job.job_title)
  const jobId = normalizeWhitespace(job.job_id)
  const applyUrl = normalizeWhitespace(job.apply_url)
  const location = buildLocationLabel(job)
  const city = firstNonEmpty(
    ...(Array.isArray(job.location_city) ? job.location_city.map((value) => normalizeCity(value) || value) : []),
    location?.split(',')?.[0],
  )

  if (!title || !jobId || !applyUrl || !location) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job.parent_department) || null,
    location,
    city,
    country: 'India',
    source: SOURCE,
    sourceUrl: applyUrl,
    applyUrl,
    jobId,
    requisitionId: normalizeWhitespace(job.job_code) || jobId,
    employmentType: null,
    experienceRequired: null,
    jobDescription: stripTags(job.job_description),
    remoteStatus: inferRemoteStatus(location),
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

export const extractJobsFromPayload = (payload = {}) =>
  (Array.isArray(payload.jobs) ? payload.jobs : [])
    .filter((job) => isIndiaLocation(job))
    .map((job) => mapUrbanCompanyJob(job))
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    Accept: 'text/html,application/xhtml+xml',
    'User-Agent': USER_AGENT,
  },
  label: 'urbancompany-careers-page',
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Origin: 'https://careers.urbancompany.com',
    Referer: `${CAREERS_URL}`,
    'User-Agent': USER_AGENT,
  },
  body: '{}',
  label: 'urbancompany-jobs-api',
})

export const createUrbanCompanyScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Urban Company verified careers page no longer matches the known public surface')
    }

    const payload = await fetchJson(JOBS_API_URL)
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('Urban Company jobs API no longer returns the expected jobs array')
    }

    return extractJobsFromPayload(payload)
  },
})

export const run = async (options = {}) => createUrbanCompanyScraper().run(options)

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
