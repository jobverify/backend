import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const JOBS_PAGE_URL = 'https://www.axiscades.com/jobs/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const buildAbsoluteUrl = (value) => new URL(value, JOBS_PAGE_URL).toString()

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractCity = (location) =>
  normalizeWhitespace(location)?.split(',')[0]?.trim() || null

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return normalized

  const [, day, month, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export const extractJobCards = (html) => {
  const cards = []
  const cardSegments = String(html ?? '')
    .split('<div class="jobcard d-flex w-100">')
    .slice(1)
    .map((segment) => segment.split('<div class="col-lg-4 col-md-6 mb-4 d-flex">')[0])

  for (const cardHtml of cardSegments) {
    const title = normalizeWhitespace(cardHtml.match(/<h5 class="jobcard-title">([\s\S]*?)<\/h5>/i)?.[1])
    const details = [...cardHtml.matchAll(/<div class="(?:me-3 )?d-flex align-items-center">[\s\S]*?<\/div>/gi)]
      .map((detailMatch) => normalizeWhitespace(detailMatch[0]))
      .filter(Boolean)
    const postingDate = parsePostingDate(details[0] || null)
    const location = normalizeWhitespace(details[1]) || null
    const employmentType = normalizeWhitespace(details[2]) || null
    const sourceUrl = normalizeWhitespace(
      cardHtml.match(/class="job-description-button" href="([^"]+)"/i)?.[1],
    )
    const popupId = normalizeWhitespace(
      cardHtml.match(/class="apply-now-button"[^>]*data-popup-id="([^"]+)"/i)?.[1],
    )
    const requisitionId = [
      slugify(title),
      slugify(location),
      postingDate,
    ].filter(Boolean).join('-')

    cards.push({
      title,
      company: 'AXISCADES',
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId: popupId || requisitionId,
      requisitionId,
      sourceUrl: sourceUrl ? buildAbsoluteUrl(sourceUrl) : JOBS_PAGE_URL,
      applyUrl: JOBS_PAGE_URL,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: null,
      companyCareerPage: JOBS_PAGE_URL,
      atsPlatform: 'official-company-careers',
    })
  }

  return cards.filter((job) => job.title && job.location && job.requisitionId)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'axiscades',
  timeoutMs: 15000,
})

export const createAxiscadesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(JOBS_PAGE_URL)
    const jobs = extractJobCards(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'axiscades',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAxiscadesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AXISCADES scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'axiscades')
    console.log('DB result:', result)
    process.exit(0)
  }
}
