import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://evertz.com/contact/careers/'
export const CAREERS_FEED_URL = 'https://evertz.com/includes/json/careers.json'
export const APPLY_URL_BASE = 'https://evertz.applytojob.com/apply/'
export const DETAIL_URL_BASE = 'https://evertz.com/contact/careers/'

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
    .replace(/&#8226;|&bull;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const buildLocation = (job = {}) => {
  const parts = [
    normalizeWhitespace(job.city),
    normalizeWhitespace(job.state),
    normalizeWhitespace(job.country_id),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : null
}

const buildApplyUrl = (boardCode) => {
  const normalized = normalizeWhitespace(boardCode)
  return normalized ? `${APPLY_URL_BASE}${normalized}` : null
}

const buildDetailUrl = (jobId) => {
  const normalized = normalizeWhitespace(jobId)
  return normalized ? `${DETAIL_URL_BASE}${normalized}` : null
}

const isIndiaJob = (job = {}) => normalizeWhitespace(job.country_id) === 'India'

export const hasCareersFeedSignal = (payload) => Array.isArray(payload)

export const extractSearchResults = (payload) => payload
  .filter((job) => isIndiaJob(job))
  .map((job) => ({
    title: normalizeWhitespace(job.title),
    company: 'Evertz India',
    department: normalizeWhitespace(job.department),
    location: buildLocation(job),
    city: normalizeWhitespace(job.city),
    country: 'India',
    jobId: normalizeWhitespace(job.id),
    requisitionId: normalizeWhitespace(job.id),
    sourceUrl: buildDetailUrl(job.id),
    applyUrl: buildApplyUrl(job.board_code),
    employmentType: normalizeWhitespace(job.type),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
    jobType: normalizeWhitespace(job.type),
    additionalLocations: null,
  }))
  .filter((job) => job.title && job.jobId && job.sourceUrl && job.applyUrl)

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

export const createEvertzIndiaScraper = ({
  maxJobs = null,
  fetchJson = defaultFetchJson,
} = {}) => ({
  async run() {
    const payload = await fetchJson(CAREERS_FEED_URL)

    if (!hasCareersFeedSignal(payload)) {
      return []
    }

    const jobs = extractSearchResults(payload)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'evertzindia',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createEvertzIndiaScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Evertz India scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'evertzindia')
    console.log('DB result:', result)
    process.exit(0)
  }
}
