import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { LLOYDS_TECHNOLOGY_CENTRE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl

const PAGE_SIZE = 20

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`.replace(/\/$/, '')
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Lloyds Technology Centre \| Careers\s*<\/title>/i.test(page)
    && text.includes('Careers at Lloyds Technology Centre')
    && text.includes("We're Lloyds Technology Centre*")
    && text.includes('Search and apply')
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const candidate = normalizeComparableUrl(match[1])
    if (
      candidate === normalizeComparableUrl(WORKDAY_BOARD_URL)
      || candidate === normalizeComparableUrl(`${WORKDAY_BOARD_URL}/`)
    ) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /rel=["']canonical["'][^>]*href=["']https:\/\/lbg\.wd3\.myworkdayjobs\.com\/Lloyds_Technology_Centre["']/i.test(page)
    && /property=["']og:url["'][^>]*content=["']https:\/\/lbg\.wd3\.myworkdayjobs\.com\/Lloyds_Technology_Centre["']/i.test(page)
    && /tenant:\s*["']lbg["']/i.test(page)
    && /siteId:\s*["']Lloyds_Technology_Centre["']/i.test(page)
}

export const buildJobsApiRequest = (offset = 0, limit = PAGE_SIZE) => ({
  appliedFacets: {},
  limit,
  offset,
  searchText: '',
})

const extractJobId = (posting = {}) => {
  const bulletFieldId = Array.isArray(posting?.bulletFields)
    ? posting.bulletFields.map(normalizeWhitespace).find((value) => /^\d+$/.test(value))
    : null

  return bulletFieldId || String(posting?.externalPath ?? '').match(/_([^/?#/_]+)(?:[/?#]|$)/)?.[1] || null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  return normalized.match(/^(Hyderabad|Bengaluru|Bangalore|Chennai|Gurugram|Gurgaon|Mumbai|Pune|Noida|New Delhi|Delhi)\b/i)?.[1] || null
}

const mapJobPosting = (posting, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const rawLocation = normalizeWhitespace(posting?.locationsText)
  const jobId = extractJobId(posting)
  const externalPath = String(posting?.externalPath ?? '').trim()
  const sourceUrl = externalPath
    ? `${WORKDAY_BOARD_URL}${externalPath.startsWith('/') ? externalPath : `/${externalPath}`}`
    : null

  if (!title || !rawLocation || !jobId || !sourceUrl) {
    throw new Error('Lloyds Technology Centre Workday jobs payload changed materially')
  }

  return {
    jobId,
    title,
    company: COMPANY,
    department: null,
    location: `${rawLocation}, India`,
    city: extractCity(rawLocation),
    country: 'India',
    link: `${sourceUrl}/apply`,
    source: SOURCE,
    postedAt: null,
    closingDate: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    experienceRequired: null,
    requisitionId: jobId,
    scrapedAt,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createLloydsTechnologyCentreScraper = ({
  now = () => new Date().toISOString(),
  pageSize = PAGE_SIZE,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Lloyds Technology Centre careers page no longer matches the trusted first-party surface')
    }

    const boardUrl = extractVerifiedWorkdayBoardUrl(careersHtml)
    if (boardUrl !== WORKDAY_BOARD_URL) {
      throw new Error('Lloyds Technology Centre verified Workday handoff changed materially')
    }

    const boardHtml = await fetchText(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable({ status: 200, html: boardHtml, url: WORKDAY_BOARD_URL }, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (!hasOfficialWorkdayBoardSignal(boardHtml)) {
      throw new Error('Lloyds Technology Centre verified Workday board changed materially')
    }

    const jobs = []
    const seenJobIds = new Set()
    let offset = 0
    let total = null

    do {
      const payload = await fetchJson(JOBS_API_URL, {
        method: 'POST',
        body: JSON.stringify(buildJobsApiRequest(offset, pageSize)),
      })
      const postings = payload?.jobPostings

      if (!Number.isInteger(payload?.total) || payload.total < 0 || !Array.isArray(postings)) {
        throw new Error('Lloyds Technology Centre Workday jobs API response changed materially')
      }
      if (postings.length === 0 && offset < payload.total) {
        throw new Error('Lloyds Technology Centre Workday jobs API returned an incomplete page')
      }

      // This Workday board reports the total only on its first API page.
      if (total === null) total = payload.total
      for (const posting of postings) {
        const job = mapJobPosting(posting, now())
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
      }
      offset += postings.length
    } while (offset < total)

    return jobs
  },
})

export const run = async (options = {}) => createLloydsTechnologyCentreScraper().run(options)

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
