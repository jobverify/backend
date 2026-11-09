import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'think41'
export const COMPANY = 'Think41'
export const CAREERS_PAGE_URL = 'https://www.think41.com/careers2'
export const JOBS_API_URL = 'https://www.think41.com/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeLocationKey = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/\([^)]*\)/g, ' ')
  .replace(/[^a-z\s,/-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

export const isIndiaLocation = (value) => {
  const normalized = normalizeLocationKey(value)
  if (!normalized) return false
  if (/\bindia\b/i.test(normalized)) return true

  if (CANONICAL_CITIES[normalized]) return true

  return Object.keys(CANONICAL_CITIES).some((cityKey) => normalized.includes(cityKey))
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const [primaryLocation] = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return normalizeCity(primaryLocation || normalized)
}

const toStringId = (value) => {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized || null
}

export const assertOfficialJobsFeed = (payload) => {
  if (!Array.isArray(payload)) {
    throw new Error('official Think41 jobs feed no longer returns the verified public array payload')
  }

  return payload
}

export const extractIndiaJobs = (payload) => assertOfficialJobsFeed(payload)
  .map((record) => {
    const title = normalizeWhitespace(record?.title)
    const jobId = toStringId(record?.id)
    const rawLocation = normalizeWhitespace(record?.job_location)
    const applyUrl = normalizeWhitespace(record?.link)

    if (!title || !jobId || !rawLocation || !applyUrl) return null
    if (!isIndiaLocation(rawLocation)) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location: normalizeLocation(rawLocation),
      city: extractCity(rawLocation),
      state: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl,
      employmentType: normalizeWhitespace(record?.job_type),
      experienceRequired: normalizeWhitespace(record?.yoe),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_PAGE_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createThink41Scraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchJson = defaultFetchJson, now: overrideNow } = {}) {
    const jobs = extractIndiaJobs(await fetchJson(JOBS_API_URL))
    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = (overrideNow || now)()

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createThink41Scraper(options).run(options)

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
