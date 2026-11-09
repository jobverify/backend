import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://exotel.com/about-us/careers/'
export const OPENINGS_API_URL = 'https://app.recruiterbox.com/widget/2176/openings/'
export const DETAIL_URL_BASE = 'https://app.recruiterbox.com/widget/2176/opening/'
const HOSTED_JOB_URL_BASE = 'https://exotel.hire.trakstar.com/jobs/'

const INDIA_CITY_FALLBACK_PATTERN =
  /\b(bengaluru|bangalore|gurugram|gurgaon|mumbai|pune|chennai|hyderabad)\b/i

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const buildLocation = (location = {}) => {
  const parts = [
    normalizeWhitespace(location.city),
    normalizeWhitespace(location.state),
    normalizeWhitespace(location.country),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : null
}

const isIndiaLikeLocation = (location = {}) => {
  const country = normalizeWhitespace(location.country)
  if (country === 'India') return true

  const city = normalizeWhitespace(location.city)
  return INDIA_CITY_FALLBACK_PATTERN.test(city || '')
}

const buildDetailUrl = (id) => {
  if (id == null) return null
  return `${DETAIL_URL_BASE}${id}/`
}

const buildApplicationUrl = (hashId) => {
  if (!hashId) return null
  return `${HOSTED_JOB_URL_BASE}${hashId}/?apply=true`
}

export const hasRecruiterboxSignal = (payload) => Array.isArray(payload)

export const extractSearchResults = (payload) => payload
  .filter((job) => isIndiaLikeLocation(job.location))
  .map((job) => ({
    title: normalizeWhitespace(job.title),
    company: normalizeWhitespace(job.company_name) || 'Exotel Techcom Pvt Ltd',
    department: normalizeWhitespace(job.team),
    location: buildLocation(job.location),
    city: normalizeWhitespace(job.location?.city),
    country: 'India',
    jobId: job.id == null ? null : String(job.id),
    requisitionId: normalizeWhitespace(job.job_code) || (job.id == null ? null : String(job.id)),
    sourceUrl: buildDetailUrl(job.id),
    applyUrl: buildApplicationUrl(job.hash_id) || buildDetailUrl(job.id),
    employmentType: normalizeWhitespace(job.position_type),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
    jobType: normalizeWhitespace(job.position_type),
    additionalLocations: null,
  }))
  .filter((job) => job.title && job.jobId && job.sourceUrl)

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createExotelScraper = ({
  maxJobs = null,
  fetchJson = defaultFetchJson,
} = {}) => ({
  async run() {
    const payload = await fetchJson(OPENINGS_API_URL)

    if (!hasRecruiterboxSignal(payload)) {
      return []
    }

    const jobs = extractSearchResults(payload)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'exotel',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createExotelScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Exotel scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'exotel')
    console.log('DB result:', result)
    process.exit(0)
  }
}
