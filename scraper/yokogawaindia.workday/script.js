import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import {
  extractCity,
  matchesWorkdayLocationPattern,
  shouldContinueWorkdayJobsApiPagination,
  shouldFetchWorkdayJobDetail,
} from '../../scraper-support/myworkday/engine.js'
import { extractWorkdayDetailLocations } from '../../scraper-support/myworkday/locationDetails.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'yokogawaindia'
export const COMPANY = 'Yokogawa India Ltd.'
export const CAREERS_URL = 'https://www.yokogawa.com/in/about/currentopenings/'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'
export const WORKDAY_BASE_URL = 'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site'
export const WORKDAY_BOARD_URL = `${WORKDAY_BASE_URL}?locationCountry=${INDIA_LOCATION_COUNTRY}`
export const JOBS_API_URL = 'https://wd3.myworkdaysite.com/wday/cxs/yokogawa/yokogawa-career-site/jobs'

const PAGE_SIZE = 20
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const INDIA_LOCATION_PATTERN = [
  'india',
  'bangalore',
  'bengaluru',
  'new delhi',
  'delhi',
  'chennai',
  'mumbai',
  'kolkata',
  'kolkatta',
  'baroda',
  'hyderabad',
  'satp',
].join('|')

const OFFICIAL_TITLE_PATTERN = /<title>\s*Career Opportunities\s*\|\s*Yokogawa India\s*<\/title>/i
const CAREERS_HEADING_PATTERN = /<h1[^>]*>\s*Career Opportunities\s*<\/h1>/i
const BRAND_COPY_PATTERN = /At\s+Yokogawa\s+India,\s+we\s+are\s+committed/i

const emptyDetailPayload = () => ({
  locations: [],
  jobDescription: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  experienceRequired: null,
  department: null,
  requisitionId: null,
})

const startOfTodayIST = () => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const nowIst = new Date(Date.now() + istOffsetMs)
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()))
}

const toUtcMidnight = (dateStr) => {
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))
}

const parsePostedOn = (raw) => {
  if (!raw) return null

  const text = String(raw).trim().toLowerCase()
  const today = startOfTodayIST()
  const daysAgo = (days) => {
    const value = new Date(today)
    value.setUTCDate(value.getUTCDate() - days)
    return value
  }

  if (/\btoday\b/.test(text)) return daysAgo(0)
  if (/\byesterday\b/.test(text)) return daysAgo(1)

  const relativeMatch = text.match(/(\d+)\s+days?\s+ago/)
  if (relativeMatch) {
    return daysAgo(Number.parseInt(relativeMatch[1], 10))
  }

  return toUtcMidnight(String(raw).replace(/^posted\s+/i, '').trim())
}

const extractJobId = (posting = {}) => {
  const requisition = Array.isArray(posting.bulletFields)
    ? posting.bulletFields.find((value) => /^R-\d+(?:-\d+)?$/i.test(String(value)))
    : null

  if (requisition) return requisition

  const match = String(posting.externalPath ?? '').match(/_(R-\d+(?:-\d+)?)(?:\/)?$/i)
  return match?.[1] ?? null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_TITLE_PATTERN.test(page)
    && CAREERS_HEADING_PATTERN.test(page)
    && BRAND_COPY_PATTERN.test(page)
}

export const hasVerifiedWorkdayBoardSignal = (html) => {
  const page = String(html ?? '')
  return /myworkdaysite/i.test(page)
    && /recruiting\/yokogawa\/yokogawa-career-site/i.test(page)
}

const isVerifiedWorkdayBoardUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://wd3.myworkdaysite.com'
      && url.pathname === '/en-US/recruiting/yokogawa/yokogawa-career-site'
      && url.searchParams.get('locationCountry') === INDIA_LOCATION_COUNTRY
  } catch {
    return false
  }
}

export const extractVerifiedWorkdayBoardUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isVerifiedWorkdayBoardUrl(match[1])) {
      return new URL(match[1]).toString()
    }
  }

  return null
}

export const buildJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
  searchText = '',
} = {}) => JSON.stringify({
  appliedFacets: {
    locationCountry: [INDIA_LOCATION_COUNTRY],
  },
  limit,
  offset,
  searchText,
})

const buildDetailUrl = (externalPath) => {
  if (!externalPath) return null

  try {
    return externalPath.startsWith('/')
      ? `${WORKDAY_BASE_URL}${externalPath}`.split('?')[0]
      : new URL(externalPath, `${WORKDAY_BASE_URL}/`).href.split('?')[0]
  } catch {
    return null
  }
}

const selectPrimaryLocation = (summaryLocation, detailLocations = []) =>
  detailLocations.find((value) =>
    matchesWorkdayLocationPattern({ location: value }, INDIA_LOCATION_PATTERN),
  ) || summaryLocation

const extractDetailPayload = async (jobUrl, fetchText) => {
  const html = await fetchText(jobUrl)

  return {
    locations: extractWorkdayDetailLocations(html),
    ...(await extractJobDetail({ provider: 'workday', html })),
  }
}

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'user-agent': USER_AGENT,
    accept: 'application/json',
  },
  body,
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: 'yokogawaindia jobs api',
})

const defaultFetchText = async (url) => fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: 3,
    baseDelayMs: 2000,
    timeoutMs: 20000,
    label: 'yokogawaindia detail',
})

export const createYokogawaIndiaScraper = ({
  maxJobs = null,
  maxPages = Number.POSITIVE_INFINITY,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const fetchText = options.fetchText || defaultFetchText

    const careersHtml = await fetchText(CAREERS_URL)
    const boardHtml = await fetchText(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable({ status: 200, html: boardHtml, url: WORKDAY_BOARD_URL }, { source: SOURCE })

    if (!hasVerifiedWorkdayBoardSignal(boardHtml)) {
      if (
        hasOfficialCareersSignal(careersHtml)
        && extractVerifiedWorkdayBoardUrl(careersHtml) !== WORKDAY_BOARD_URL
      ) {
        throw new Error('Yokogawa India verified Workday handoff changed; refusing to guess the public jobs source')
      }

      throw new Error('Yokogawa India verified Workday board changed; refusing to guess the public jobs source')
    }

    const jobs = []
    const seenLinks = new Set()
    let offset = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(
        JOBS_API_URL,
        buildJobsRequestBody({ offset }),
      )
      if (!Array.isArray(payload?.jobPostings)) {
        throw new Error('Yokogawa India Workday jobs API no longer exposes jobPostings')
      }

      const postings = payload.jobPostings

      if (page === 1 && postings.length === 0) {
        return []
      }

      for (const posting of postings) {
        const summaryLocation = String(posting?.locationsText ?? '').trim() || 'Unknown'
        if (!shouldFetchWorkdayJobDetail({ location: summaryLocation }, INDIA_LOCATION_PATTERN)) {
          continue
        }

        const link = buildDetailUrl(posting?.externalPath)
        if (!link || seenLinks.has(link)) continue

        seenLinks.add(link)

        let detailPayload
        try {
          detailPayload = await extractDetailPayload(link, fetchText)
        } catch (error) {
          console.warn(`  [${SOURCE}] Failed to enrich ${link}: ${error.message}`)
          detailPayload = emptyDetailPayload()
        }

        if (!matchesWorkdayLocationPattern(
          { location: summaryLocation, locations: detailPayload.locations },
          INDIA_LOCATION_PATTERN,
        )) {
          continue
        }

        const location = selectPrimaryLocation(summaryLocation, detailPayload.locations)
        const jobId = extractJobId(posting)

        jobs.push({
          jobId,
          title: posting.title,
          company: COMPANY,
          department: detailPayload.department,
          location,
          city: extractCity(location),
          locations: detailPayload.locations,
          link,
          source: SOURCE,
          postedAt: parsePostedOn(posting.postedOn),
          closingDate: null,
          jobDescription: detailPayload.jobDescription,
          minimumQualification: detailPayload.minimumQualification,
          preferredQualification: detailPayload.preferredQualification,
          requiredSkills: detailPayload.requiredSkills,
          experienceRequired: detailPayload.experienceRequired,
          publicExperienceChecked: detailPayload.publicExperienceChecked,
          requisitionId: detailPayload.requisitionId || jobId,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs.slice(0, maxJobs)
        }
      }

      offset += postings.length
      if (!shouldContinueWorkdayJobsApiPagination({
        jobsCount: postings.length,
        offsetAfterPage: offset,
        payloadTotal: payload?.total || 0,
        pageSize: PAGE_SIZE,
      })) {
        break
      }
    }

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async () => createYokogawaIndiaScraper().run()

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
