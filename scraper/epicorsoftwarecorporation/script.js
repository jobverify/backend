import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import EPICOR_SOFTWARE_CORPORATION_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EPICOR_SOFTWARE_CORPORATION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const PAGE_SIZE = 20
const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'content-type': 'application/json',
  },
  body,
  label: `${SOURCE}-json`,
  timeoutMs: 20000,
})

const fetchCareersTextAllowingChallenge = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    html: await response.text(),
  }
}

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Jobs\s*\|\s*Epicor\s*<\/title>/i.test(page)
    && new RegExp(`href=["']${escapeForRegex(WORKDAY_BOARD_URL)}["']`, 'i').test(page)
    && /jobs\.epicor\.com/i.test(page)
    && /Contact Us/i.test(page)
}

export const hasCloudflareChallengeSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    && /(cloudflare|verify you are human|verify your browser|checking if the site connection is secure|challenge-running)/i.test(page)
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${escapeForRegex(WORKDAY_BOARD_URL)}["']`, 'i').test(page)
    && /epicorjobs\/assets\/logo/i.test(page)
}

const isHttp403Error = (error) => Number(error?.status) === 403 || /HTTP 403\b/i.test(String(error?.message ?? ''))

export const buildJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: '',
})

const isIndiaDescriptor = (value = '') => /\b(india|bangalore|bengaluru|hyderabad|remote)\b/i.test(
  normalizeWhitespace(value) || '',
)

const buildDetailUrl = (externalPath) => {
  if (!externalPath) return null

  try {
    if (String(externalPath).startsWith('/')) {
      return `${WORKDAY_BOARD_URL}${externalPath}`.split('?')[0]
    }

    return new URL(String(externalPath), `${WORKDAY_BOARD_URL}/`).toString().split('?')[0]
  } catch {
    return null
  }
}

const extractJobId = (posting = {}) => {
  const requisitionId = Array.isArray(posting?.bulletFields)
    ? posting.bulletFields.find((value) => /^JR\d+$/i.test(String(value)))
    : null

  if (requisitionId) return requisitionId

  const externalPath = String(posting?.externalPath ?? '')
  const fromPath = externalPath.match(/_(JR\d+)(?:\/|$)/i)?.[1]
  return fromPath || null
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/india[-\s]+bangalore/i.test(normalized) || /bengaluru/i.test(normalized)) return 'Bangalore, India'
  if (/india[-\s]+hyderabad/i.test(normalized)) return 'Hyderabad, India'
  if (/remote/i.test(normalized)) return 'Remote, India'
  if (/\bindia\b/i.test(normalized)) return normalized.replace(/-/g, ', ')
  return `${normalized.replace(/-/g, ', ')}, India`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('bangalore') || normalized.includes('bengaluru')) return 'Bangalore'
  if (normalized.includes('hyderabad')) return 'Hyderabad'
  if (normalized.includes('remote')) return 'Remote'
  return null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizePosting = (posting, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const locationLabel = normalizeWhitespace(posting?.locationsText)
  if (!title || !locationLabel || !isIndiaDescriptor(locationLabel)) return null

  const link = buildDetailUrl(posting?.externalPath)
  const jobId = extractJobId(posting)
  if (!link || !jobId) {
    throw new Error('Epicor verified jobs payload changed materially')
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location: normalizeLocation(locationLabel),
    city: extractCity(locationLabel),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: link,
    applyUrl: link,
    employmentType: normalizeEmploymentType(posting?.timeType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: /remote/i.test(locationLabel) ? 'Remote' : 'On-site',
    source: SOURCE,
    link,
    scrapedAt,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

export const createEpicorSoftwareCorporationScraper = ({
  now = () => new Date().toISOString(),
  maxPages = Number.POSITIVE_INFINITY,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (!isHttp403Error(error)) {
        throw error
      }

      const fallbackPage = await fetchCareersTextAllowingChallenge(CAREERS_URL)
      careersHtml = fallbackPage.html
    }

    if (!hasOfficialCareersSignal(careersHtml) && !hasCloudflareChallengeSignal(careersHtml)) {
      throw new Error('The verified Epicor jobs shell no longer matches the trusted first-party surface')
    }

    const boardHtml = await fetchText(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable({ status: 200, html: boardHtml, url: WORKDAY_BOARD_URL }, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (!hasOfficialWorkdayBoardSignal(boardHtml)) {
      throw new Error('The verified Epicor Workday board no longer matches the trusted public surface')
    }

    const jobs = []
    const seenJobIds = new Set()
    let offset = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(
        JOBS_API_URL,
        buildJobsRequestBody({ offset }),
      )

      const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []
      if (page === 1 && postings.length === 0) return []

      let acceptedOnPage = 0
      for (const posting of postings) {
        const job = normalizePosting(posting, now())
        if (!job || seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
        acceptedOnPage += 1
      }

      offset += acceptedOnPage
      if (postings.length === 0 || offset >= Number(payload?.total || 0)) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createEpicorSoftwareCorporationScraper(options).run(options)

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
