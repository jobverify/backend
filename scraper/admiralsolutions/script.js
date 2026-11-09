import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'admiralsolutions'
export const COMPANY = 'Admiral Solutions'
export const CAREER_PAGE_URL = 'https://career.admiralsolutions.in/vacancies/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|span|h[1-6])>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/Â£/g, 'GBP')
    .replace(/[Â]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

const buildJobUrl = (href) => new URL(href, CAREER_PAGE_URL).toString()

const extractField = (block, className) =>
  normalizeWhitespace(
    String(block ?? '').match(
      new RegExp(`<div class="${className}">[\\s\\S]*?<p>([\\s\\S]*?)<\\/p>`, 'i'),
    )?.[1] || null,
  )

export const extractSearchResults = (html) =>
  [...String(html ?? '').matchAll(/<div class="page-career-list-item">([\s\S]*?)<\/div>\s*<\/div>/gi)]
    .map((match) => {
      const block = match[1] || ''
      const title = normalizeWhitespace(block.match(/<h4>([\s\S]*?)<\/h4>/i)?.[1])
      const href = normalizeWhitespace(block.match(/<a class="box-button" href="([^"]+)"/i)?.[1])
      const location = extractField(block, 'page-career-list-item-body-location')
      const closingDate = toIsoDate(extractField(block, 'page-career-list-item-body-date'))
      const department = extractField(block, 'page-career-list-item-body-department')
      const salary = extractField(block, 'page-career-list-item-body-benefits')
      const jobId = href?.match(/\/vacancies\/(\d+)\//i)?.[1] || null

      if (!title || !href || !location || !jobId) return null

      return {
        title,
        company: COMPANY,
        department,
        location: `${location}, India`,
        city: location,
        state: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: buildJobUrl(href),
        applyUrl: buildJobUrl(href),
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate,
        jobDescription: salary ? `Salary & Benefits: ${salary}` : null,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createAdmiralSolutionsScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const jobs = extractSearchResults(await fetchText(CAREER_PAGE_URL))
    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = (overrideNow || now)()

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createAdmiralSolutionsScraper(options).run(options)

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
