import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hindustanunilever'
export const COMPANY = 'Hindustan Unilever Limited'
export const CAREERS_URL = 'https://careers.unilever.com/en/location/india-jobs/34155/1269750/2/1'
export const LOCATION_PAGE_URL = CAREERS_URL

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const extractJobId = (value) => {
  const normalized = String(value ?? '')
  const dataJobId = normalized.match(/data-job-id=["'](\d+)["']/i)?.[1]
  if (dataJobId) return dataJobId

  const segments = [...normalized.matchAll(/\/(\d+)(?:[/?#]|$)/g)]
  return segments.at(-1)?.[1] || null
}

const splitLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    city: parts[0] || null,
    state: parts.length > 2 ? parts[1] : null,
    country: parts.at(-1) || 'India',
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title[^>]*>\s*Search India Jobs at Unilever\s*<\/title>/i.test(page)
    && normalized.includes('jobs in india')
    && /class=["'][^"']*global-job-list__title[^"']*["']/i.test(page)
    && /href=["'](?:https:\/\/careers\.unilever\.com)?\/en\/job\/[^"']+["']/i.test(page)
}

export const extractLocalJobs = (html) => Array.from(
  String(html ?? '').matchAll(
    /<a\b([^>]*href=["']((?:https:\/\/careers\.unilever\.com)?\/en\/job\/[^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi,
  ),
  (match) => {
    const attributes = match[1]
    const applyUrl = new URL(match[2], LOCATION_PAGE_URL).toString()
    const anchorHtml = match[3]
    const rawLocation = stripTags(
      anchorHtml.match(/<span[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
    )
    const title = stripTags(
      anchorHtml.match(/<h2[^>]*class=["'][^"']*global-job-list__title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1],
    ) || stripTags(anchorHtml)
    const location = /india/i.test(rawLocation) ? rawLocation : `${rawLocation}, India`
    const { city, state, country } = splitLocation(location)
    const jobId = extractJobId(attributes) || extractJobId(applyUrl)

    return {
      jobId,
      title,
      location,
      city,
      state,
      country,
      sourceUrl: applyUrl,
      applyUrl,
    }
  },
).filter((job) => job.jobId && job.title && job.location)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHindustanUnileverScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const locationHtml = await fetchText(LOCATION_PAGE_URL)

    if (!hasOfficialCareersSignal(locationHtml)) {
      throw new Error('Hindustan Unilever verified official India careers surface changed')
    }

    const jobs = extractLocalJobs(locationHtml)
      .map((job) => ({
        jobId: job.jobId,
        title: job.title,
        company: COMPANY,
        location: job.location,
        city: job.city,
        state: job.state,
        country: job.country,
        requisitionId: null,
        sourceUrl: job.sourceUrl,
        applyUrl: job.applyUrl,
        employmentType: null,
        department: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'Apply via the official Unilever India careers page.',
      }))
      .sort((left, right) => left.title.localeCompare(right.title) || left.location.localeCompare(right.location))

    return jobs
  },
})

export const run = async (options = {}) => createHindustanUnileverScraper().run(options)

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
