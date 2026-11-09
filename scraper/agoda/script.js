import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'agoda'
export const COMPANY = 'Agoda'
export const GREENHOUSE_API_URL =
  'https://boards-api.greenhouse.io/v1/boards/agoda/jobs?content=true'

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
    /country|location/i.test(String(entry?.name ?? ''))
    && /india/i.test(String(entry?.value ?? '')))

export const isIndiaJob = (job = {}) => {
  const locationText = [
    job?.location?.name,
    ...(Array.isArray(job?.offices) ? job.offices.map((office) => office?.location ?? office?.name) : []),
  ]
    .filter(Boolean)
    .join(' ')

  return /\bindia\b/i.test(locationText) || metadataIncludesIndia(job.metadata)
}

const inferCity = (locationName) => normalizeWhitespace(String(locationName ?? '').split(',')[0]) || null

const mapJob = (job = {}) => {
  const title = normalizeWhitespace(job?.title)
  const location = normalizeWhitespace(job?.location?.name)
  const sourceUrl = normalizeWhitespace(job?.absolute_url)

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

export const createAgodaScraper = () => ({
  async run({ fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const payload = await fetchJson(GREENHOUSE_API_URL)

    return extractJobsFromGreenhousePayload(payload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAgodaScraper().run(options)

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
