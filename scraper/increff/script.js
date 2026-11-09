import path from 'path'
import { fileURLToPath } from 'url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://www.increff.com/careers'
export const PUBLIC_BOARD_URL = 'https://increff.zohorecruit.com/jobs/Careers'
export const API_URL =
  'https://increff.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || ''

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/intern/.test(normalized)) return 'Internship'
  return normalizeWhitespace(value)
}

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

const buildLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State)
  const country = normalizeWhitespace(record.Country)
  const location = [city, state, country].filter(Boolean).join(', ')

  return {
    location: location || null,
    city,
    state,
    country,
  }
}

export const buildApiUrl = () => API_URL

export const buildJobUrl = (jobId, title) =>
  `${PUBLIC_BOARD_URL}/${normalizeWhitespace(jobId) || ''}/${slugify(title)}?source=CareerSite`

export const extractSearchResults = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const department = normalizeWhitespace(record.Department || record.Department_Name)
      const experienceRequired = normalizeWhitespace(record.Work_Experience)
      const postingDate = normalizeWhitespace(record.Date_Opened || record.Created_Time)
      const jobDescription = normalizeWhitespace(record.Job_Description)
      const {
        location,
        city,
        state,
        country,
      } = buildLocation(record)

      if (!title || !jobId || !location) return null

      const sourceUrl = normalizeWhitespace(record.$url) || buildJobUrl(jobId, title)

      return {
        title,
        company: 'Increff',
        department,
        location,
        city,
        state,
        country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate,
        closingDate: null,
        jobDescription,
      }
    })
    .filter(Boolean)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'increff',
  timeoutMs: 15000,
})

export const createIncreffScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const jobs = extractSearchResults(await fetchJson(buildApiUrl()))
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'increff',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createIncreffScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  }

  console.log(`Total India jobs scraped: ${jobs.length}`)
}
