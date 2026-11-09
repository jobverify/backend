import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://jobs.firstcitizens.com/'
export const JOBS_API_BASE_URL = 'https://jobs.firstcitizens.com/api/jobs'

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

export const buildJobsApiUrl = (page = 1) =>
  `${JOBS_API_BASE_URL}?page=${page}&country=India`

const buildLocation = (job = {}) => [
  normalizeWhitespace(job.city),
  normalizeWhitespace(job.state),
  normalizeWhitespace(job.country),
].filter(Boolean).join(', ') || null

const buildSourceUrl = (slug) => {
  const normalized = normalizeWhitespace(slug)
  return normalized ? `https://jobs.firstcitizens.com/jobs/${normalized}?lang=en-us` : null
}

export const hasJibeSignal = (payload) =>
  payload && Array.isArray(payload.jobs) && Number.isInteger(payload.totalCount)

export const extractSearchResults = (payload) => (payload.jobs || [])
  .filter((job) => normalizeWhitespace(job.country) === 'India')
  .map((job) => ({
    title: normalizeWhitespace(job.title),
    company: 'First Citizens India',
    department: normalizeWhitespace(job.tags1 || job.tags2 || job.tags3 || job.tags4),
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

export const createFirstCitizensIndiaScraper = ({
  maxPages = 1,
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

      if (payload.jobs.length === 0 || jobs.length >= (maxJobs || Number.MAX_SAFE_INTEGER)) {
        break
      }
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'firstcitizensindia',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createFirstCitizensIndiaScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running First Citizens India scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'firstcitizensindia')
    console.log('DB result:', result)
    process.exit(0)
  }
}
