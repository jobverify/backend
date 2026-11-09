import path from 'path'
import { fileURLToPath } from 'url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'epsilon'
export const COMPANY = 'Epsilon'
export const CAREERS_URL = 'https://www.epsilon.com/apac/careers-at-epsilon'
export const PUBLIC_JOBS_BOARD_URL = 'https://careers.publicisgroupe.com/epsilon/jobs'
export const INDIA_LOCATION_URL = 'https://careers.publicisgroupe.com/epsilon/jobs/locations/country/India?lang=en-US'
export const JOBS_API_BASE_URL = 'https://careers.publicisgroupe.com/api/jobs'
export const PUBLIC_JOB_DETAIL_BASE_URL = 'https://careers.publicisgroupe.com/jobs'
export const JOBS_PER_PAGE = 10

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeWhitespace(item)).filter(Boolean)
  }

  const normalized = normalizeWhitespace(value)
  return normalized ? [normalized] : []
}

const getFirstListValue = (value) => normalizeList(value)[0] || null

const getJobData = (job) => job?.data || job || {}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const buildLocation = (job = {}) => [
  normalizeWhitespace(job.city),
  normalizeWhitespace(job.state),
  normalizeWhitespace(job.country),
].filter(Boolean).join(', ') || null

const buildSourceUrl = (slugOrId) => {
  const normalized = normalizeWhitespace(slugOrId)
  return normalized ? `${PUBLIC_JOB_DETAIL_BASE_URL}/${normalized}?lang=en-us` : null
}

export const buildJobsApiUrl = (page = 1) => {
  const url = new URL(JOBS_API_BASE_URL)
  url.searchParams.set('page', String(page))
  url.searchParams.set('country', 'India')
  url.searchParams.set('tags2', 'Epsilon')
  url.searchParams.set('internal', 'false')
  url.searchParams.set('separator', '|')
  url.searchParams.set('facetField', 'country|state|city|location_type')
  return url.toString()
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Epsilon/i.test(page)
    && /href="https:\/\/careers\.publicisgroupe\.com\/epsilon\/jobs"/i.test(page)
    && /(Explore all jobs|Open positions)/i.test(page)
}

export const hasOfficialPublicBoardErrorSignal = (html) => {
  const page = String(html ?? '')
  const title = extractTitle(page) || ''
  const text = (normalizeWhitespace(page) || '').toLowerCase()

  return /epsilon/i.test(title)
    && text.includes('oops')
    && text.includes('an error occurred')
    && text.includes('general error')
    && text.includes('connect with us')
}

export const hasVisiblePublicJobLink = (html) => (
  /href=["'][^"']*\/jobs\/\d+[^"']*["']/i.test(String(html ?? ''))
  || /href=["'][^"']*\/epsilon\/jobs\/\d+[^"']*["']/i.test(String(html ?? ''))
)

export const hasJibeSignal = (payload) =>
  payload && Array.isArray(payload.jobs) && Number.isInteger(payload.totalCount)

export const isVerifiedPublicBoardOutage = ({
  boardHtml,
  indiaLocationHtml,
}) => (
  hasOfficialPublicBoardErrorSignal(boardHtml)
  && hasOfficialPublicBoardErrorSignal(indiaLocationHtml)
  && !hasVisiblePublicJobLink(boardHtml)
  && !hasVisiblePublicJobLink(indiaLocationHtml)
)

export const extractSearchResults = (payload) => (payload.jobs || [])
  .map((job) => getJobData(job))
  .filter((job) => normalizeWhitespace(job.country) === 'India')
  .map((job) => ({
    title: normalizeWhitespace(job.title),
    company: COMPANY,
    department: getFirstListValue(job.tags1) || getFirstListValue(job.category) || getFirstListValue(job.tags),
    location: buildLocation(job),
    city: normalizeWhitespace(job.city),
    country: 'India',
    jobId: normalizeWhitespace(job.req_id) || normalizeWhitespace(job.slug),
    requisitionId: normalizeWhitespace(job.req_id) || normalizeWhitespace(job.slug),
    sourceUrl: buildSourceUrl(job.slug || job.req_id),
    applyUrl: normalizeWhitespace(job.apply_url),
    employmentType: normalizeWhitespace(job.employment_type),
    experienceRequired: getFirstListValue(job.tags5),
    minimumQualification: normalizeWhitespace(job.qualifications),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job.posted_date),
    closingDate: null,
    jobDescription: normalizeWhitespace(job.description || job.responsibilities),
    jobType: getFirstListValue(job.tags3) || normalizeWhitespace(job.employment_type),
    additionalLocations: null,
  }))
  .filter((job) => job.title && job.jobId && job.sourceUrl)

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
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEpsilonScraper = ({
  maxPages = 20,
  maxJobs = null,
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
} = {}) => ({
  async run() {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Official Epsilon careers handoff changed; refusing to guess the public jobs surface')
    }

    const jobs = []

    for (let page = 1; page <= maxPages; page += 1) {
      let payload

      try {
        payload = await fetchJson(buildJobsApiUrl(page))
      } catch (error) {
        if (page === 1) {
          const [boardHtml, indiaLocationHtml] = await Promise.all([
            fetchText(PUBLIC_JOBS_BOARD_URL),
            fetchText(INDIA_LOCATION_URL),
          ])

          if (isVerifiedPublicBoardOutage({ boardHtml, indiaLocationHtml })) {
            return []
          }
        }

        throw error
      }

      if (!hasJibeSignal(payload)) {
        if (page === 1) {
          const [boardHtml, indiaLocationHtml] = await Promise.all([
            fetchText(PUBLIC_JOBS_BOARD_URL),
            fetchText(INDIA_LOCATION_URL),
          ])

          if (isVerifiedPublicBoardOutage({ boardHtml, indiaLocationHtml })) {
            return []
          }

          throw new Error('Epsilon public Jibe API response changed')
        }
        break
      }

      const pageJobs = extractSearchResults(payload)
      jobs.push(...pageJobs)

      const reachedMaxJobs = Number.isInteger(maxJobs) && jobs.length >= maxJobs
      const hasMorePages = payload.jobs.length > 0 && page * JOBS_PER_PAGE < payload.totalCount

      if (reachedMaxJobs || !hasMorePages) {
        break
      }
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createEpsilonScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Epsilon scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
