import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://careers.hrblock.com/jobs'
export const JOBS_API_BASE_URL = 'https://careers.hrblock.com/api/jobs'
export const JOBS_API_QUERY = new URLSearchParams({
  country: 'India',
  internal: 'false',
  separator: '|',
  facetField: 'country|state|city|location_type',
})

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

const getJobData = (job) => job?.data || job || {}

const getPrimaryCategory = (categories) => {
  if (!Array.isArray(categories) || categories.length === 0) return null
  const category = categories[0]
  return normalizeWhitespace(category?.name || category)
}

export const buildJobsApiUrl = (page = 1) => {
  const url = new URL(JOBS_API_BASE_URL)
  url.searchParams.set('page', String(page))
  for (const [key, value] of JOBS_API_QUERY.entries()) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

const buildLocation = (job = {}) => [
  normalizeWhitespace(job.city),
  normalizeWhitespace(job.state),
  normalizeWhitespace(job.country),
].filter(Boolean).join(', ') || null

const buildSourceUrl = (slug) => {
  const normalized = normalizeWhitespace(slug)
  return normalized ? `${CAREER_PAGE_URL}/${normalized}?lang=en-us` : null
}

export const hasJibeSignal = (payload) =>
  payload && Array.isArray(payload.jobs) && Number.isInteger(payload.totalCount)

export const extractSearchResults = (payload) => (payload.jobs || [])
  .map((job) => getJobData(job))
  .filter((job) => normalizeWhitespace(job.country) === 'India')
  .map((job) => ({
    title: normalizeWhitespace(job.title),
    company: 'H&R Block',
    department: getPrimaryCategory(job.categories) || normalizeWhitespace(job.department),
    location: buildLocation(job),
    city: normalizeWhitespace(job.city),
    country: 'India',
    jobId: normalizeWhitespace(job.req_id) || normalizeWhitespace(job.slug),
    requisitionId: normalizeWhitespace(job.req_id) || normalizeWhitespace(job.slug),
    sourceUrl: buildSourceUrl(job.slug),
    applyUrl: normalizeWhitespace(job.apply_url),
    employmentType: normalizeWhitespace(job.employment_type),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job.posted_date),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description),
    jobType: normalizeWhitespace(job.employment_type),
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

export const createHrblockScraper = ({
  maxPages = 10,
  maxJobs = null,
  fetchJson = defaultFetchJson,
} = {}) => ({
  async run() {
    const jobs = []

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(buildJobsApiUrl(page))
      if (!hasJibeSignal(payload)) break

      const pageJobs = extractSearchResults(payload)
      jobs.push(...pageJobs)

      const reachedMaxJobs = Number.isInteger(maxJobs) && jobs.length >= maxJobs
      const totalCount = Number.isInteger(payload.totalCount) ? payload.totalCount : null
      const hasMorePages = payload.jobs.length > 0 && (totalCount == null || page * 10 < totalCount)

      if (reachedMaxJobs || !hasMorePages) {
        break
      }
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'hrblock',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createHrblockScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running H&R Block scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'hrblock')
    console.log('DB result:', result)
    process.exit(0)
  }
}
