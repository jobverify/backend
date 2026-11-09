import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import COCKROACHDB_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export const SOURCE = COCKROACHDB_CATALOG.source
export const COMPANY = COCKROACHDB_CATALOG.companyName
export const PROVIDER_METADATA = COCKROACHDB_CATALOG
export const GREENHOUSE_JOBS_API_URL = `${COCKROACHDB_CATALOG.greenhouseJobsApiUrl}?content=true`

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

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
    department: normalizeWhitespace(job?.departments?.[0]?.name) || 'Other',
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
    postingDate: normalizeWhitespace(job?.first_published)?.slice(0, 10) || null,
    closingDate: null,
    jobDescription: normalizeWhitespace(job?.content),
  }
}

export const extractJobsFromGreenhousePayload = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter(isIndiaJob)
    .map(mapJob)
    .filter(Boolean)

export const createCockroachDbScraper = () => ({
  async run({ fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const payload = await fetchJson(GREENHOUSE_JOBS_API_URL)
    const jobs = extractJobsFromGreenhousePayload(payload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createCockroachDbScraper().run(options)

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
