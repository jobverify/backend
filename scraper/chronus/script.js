import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import {hasCurrentChronusClient,runCurrentChronus} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://chronus.com/about-us/careers'
export const OPENINGS_API_URL = 'https://app.recruiterbox.com/widget/8241/openings/'
export const DETAIL_URL_BASE = 'https://app.recruiterbox.com/widget/8241/opening/'

const INDIA_CITY_FALLBACK_PATTERN = /\b(chennai|bengaluru|bangalore|gurugram|gurgaon|mumbai|pune|hyderabad)\b/i
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

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

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Careers at Chronus\s*<\/title>/i.test(page)
    && /Open Positions/i.test(page)
    && /widget\/8241\/rbox_api\.js/i.test(page)
    && /recruiterbox\.com/i.test(page)
}

export const hasRecruiterboxSignal = (payload) => Array.isArray(payload)

export const extractSearchResults = (payload = []) => payload
  .filter((job) => isIndiaLikeLocation(job.location))
  .map((job) => ({
    title: normalizeWhitespace(job.title),
    company: normalizeWhitespace(job.company_name) || 'Chronus',
    department: normalizeWhitespace(job.team),
    location: buildLocation(job.location),
    city: normalizeWhitespace(job.location?.city),
    country: 'India',
    jobId: job.id == null ? null : String(job.id),
    requisitionId: normalizeWhitespace(job.job_code) || (job.id == null ? null : String(job.id)),
    sourceUrl: buildDetailUrl(job.id),
    applyUrl: buildDetailUrl(job.id),
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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'chronus',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'chronus',
  timeoutMs: 15000,
})

export const createChronusScraper = ({ maxJobs = null, fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) => ({
  async run(options={}) {
    const careersHtml = await (options.fetchText??fetchText)(CAREER_PAGE_URL)
    if(hasCurrentChronusClient(careersHtml))return runCurrentChronus({...options,maxJobs:options.maxJobs??maxJobs})
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('verified Chronus careers page no longer embeds the public Recruiterbox widget')
    }

    const payload = await fetchJson(OPENINGS_API_URL)
    if (!hasRecruiterboxSignal(payload)) return []

    const jobs = extractSearchResults(payload)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'chronus',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createChronusScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'chronus')
}
