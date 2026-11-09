import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'rapyutarobotics'
export const COMPANY = 'Rapyuta Robotics'
export const CAREERS_URL = 'https://www.rapyuta-robotics.com/careers/'
export const WIDGET_API_URL = 'https://apply.workable.com/api/v1/widget/accounts/rapyuta-robotics'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const titleCase = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase())

const buildLocation = ({ city, state, country }) => [city, state, country]
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean)
  .map((part) => titleCase(part))
  .join(', ') || null

const isIndiaCountry = (value) => normalizeWhitespace(value).toLowerCase() === 'india'

const extractPrimaryLocation = (job) => {
  const visibleLocation = Array.isArray(job?.locations)
    ? job.locations.find((location) => !location?.hidden)
    : null

  return {
    city: visibleLocation?.city ?? job?.city ?? null,
    state: visibleLocation?.region ?? job?.state ?? null,
    country: visibleLocation?.country ?? job?.country ?? null,
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('all open positions')
    && normalized.includes('loading open positions')
    && page.includes(WIDGET_API_URL)
}

export const extractIndiaJobs = (payload) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : []

  return jobs
    .map((job) => {
      const { city, state, country } = extractPrimaryLocation(job)
      if (!isIndiaCountry(country) || !normalizeWhitespace(job?.shortcode) || !normalizeWhitespace(job?.title)) {
        return null
      }

      const location = buildLocation({ city, state, country })
      const jobId = normalizeWhitespace(job.shortcode).toUpperCase()
      const applyUrl = normalizeWhitespace(job.application_url || job.url) || null
      const sourceUrl = normalizeWhitespace(job.url) || applyUrl

      return {
        title: normalizeWhitespace(job.title),
        company: COMPANY,
        location,
        city: city ? titleCase(city) : null,
        state: state ? titleCase(state) : null,
        country: country ? titleCase(country) : null,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeWhitespace(job.employment_type) || null,
        department: normalizeWhitespace(job.department) || null,
        experienceRequired: normalizeWhitespace(job.experience) || null,
        minimumQualification: normalizeWhitespace(job.education) || null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job.published_on) || null,
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title) || left.location.localeCompare(right.location))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'rapyutarobotics careers page',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: 'rapyutarobotics workable widget',
  timeoutMs: 15000,
})

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Rapyuta Robotics scraper')
  }

  return parsed.toISOString()
}

export const createRapyutaRoboticsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Rapyuta Robotics official careers handoff changed; refusing to guess the public jobs feed')
    }

    const payload = await fetchJson(WIDGET_API_URL)
    if (normalizeWhitespace(payload?.name) !== COMPANY || !Array.isArray(payload?.jobs)) {
      throw new Error('Rapyuta Robotics verified Workable widget payload changed')
    }

    const limit = Number.isInteger(options.maxJobs) ? options.maxJobs : maxJobs
    const jobs = extractIndiaJobs(payload)
    const selected = limit ? jobs.slice(0, limit) : jobs
    const scrapedAt = normalizeScrapedAt((options.now || now)())

    return selected.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createRapyutaRoboticsScraper().run(options)

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
