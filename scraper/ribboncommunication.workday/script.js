import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ribboncommunication'
export const COMPANY_NAME = 'Ribbon Communications'
export const CAREER_PAGE_URL = 'https://ribboncommunications.com/company/careers'
export const WORKDAY_BASE_URL = 'https://vhr-genband.wd1.myworkdayjobs.com/ribboncareers'
export const WORKDAY_DETAIL_URL_BASE = 'https://vhr-genband.wd1.myworkdayjobs.com/en-US/ribboncareers'
export const WORKDAY_JOBS_API_URL =
  'https://vhr-genband.wd1.myworkdayjobs.com/wday/cxs/vhr_genband/ribboncareers/jobs'
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'
export const PAGE_SIZE = 20

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_CAREERS_PAGE_PATTERNS = [
  /ribbon careers/i,
  /find your next job/i,
  /myworkdayjobs/i,
]

const VERIFIED_WORKDAY_BOARD_PATTERNS = [
  /careers at ribbon/i,
  /ribbon communications\s*\(nasdaq:\s*rbbn\)/i,
  /tenant:\s*"vhr_genband"/i,
  /siteId:\s*"ribboncareers"/i,
]

const DETAIL_SCRIPT_PATTERN =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'content-type': 'application/json',
    ...(options.headers || {}),
  },
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: `${SOURCE} jobs api`,
})

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const startOfTodayIST = () => {
  const offsetMs = 5.5 * 60 * 60 * 1000
  const nowIST = new Date(Date.now() + offsetMs)
  return new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()))
}

const toUTCMidnight = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

const parsePostedOn = (value) => {
  const text = normalizeWhitespace(value).toLowerCase()
  if (!text) return null

  const today = startOfTodayIST()
  const daysAgo = (days) => {
    const result = new Date(today)
    result.setUTCDate(result.getUTCDate() - days)
    return result
  }

  if (/\btoday\b/.test(text)) return daysAgo(0)
  if (/\byesterday\b/.test(text)) return daysAgo(1)

  const relativeMatch = text.match(/(\d+)\s+days?\s+ago/)
  if (relativeMatch) {
    return daysAgo(Number.parseInt(relativeMatch[1], 10))
  }

  return toUTCMidnight(text.replace(/^posted\s+/i, ''))
}

const parseJobPostingJsonLd = (html) => {
  for (const [, payload] of String(html ?? '').matchAll(DETAIL_SCRIPT_PATTERN)) {
    try {
      const data = JSON.parse(payload)
      const records = Array.isArray(data) ? data : [data]
      const record = records.find((item) => {
        const types = Array.isArray(item?.['@type']) ? item['@type'] : [item?.['@type']]
        return types.some((type) => /jobposting/i.test(String(type)))
      })

      if (record) return record
    } catch {
      continue
    }
  }

  return null
}

const extractEmploymentType = (html) => {
  const record = parseJobPostingJsonLd(html)
  return normalizeWhitespace(record?.employmentType) || null
}

const extractDetailLocations = (html) => {
  const record = parseJobPostingJsonLd(html)
  const locality = normalizeWhitespace(record?.jobLocation?.address?.addressLocality)
  const country = normalizeWhitespace(record?.jobLocation?.address?.addressCountry)

  if (locality && country && /india/i.test(country)) {
    return [`${locality}, India`]
  }

  return []
}

const extractJobId = (posting = {}) =>
  normalizeWhitespace(
    Array.isArray(posting?.bulletFields)
      ? posting.bulletFields.find((value) => /^REQ-\d{4}-\d+$/i.test(String(value)))
      : null,
  )
  || String(posting?.externalPath ?? '').match(/_(REQ-\d{4}-\d+)(?:\/)?$/i)?.[1]
  || null

const buildDetailUrl = (externalPath) => {
  const normalized = normalizeWhitespace(externalPath)
  if (!normalized) return null

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.split('?')[0]
  }

  const suffix = normalized.startsWith('/') ? normalized : `/${normalized}`
  return `${WORKDAY_DETAIL_URL_BASE}${suffix}`.split('?')[0]
}

const buildApplyUrl = (sourceUrl) => (sourceUrl ? `${sourceUrl.replace(/\/$/, '')}/apply` : null)

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return /^india$/i.test(parts[0]) ? null : parts[0]

  return /^india$/i.test(parts[0]) ? parts.at(-1) : parts[0]
}

const isIndiaLocation = (value) => /\bindia\b/i.test(String(value ?? ''))

const emptyDetailPayload = () => ({
  locations: [],
  employmentType: null,
  jobDescription: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  experienceRequired: null,
  department: null,
  requisitionId: null,
})

export const hasOfficialCareersPageSignal = (html) =>
  OFFICIAL_CAREERS_PAGE_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedWorkdayBoardSignal = (html) =>
  VERIFIED_WORKDAY_BOARD_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const extractVerifiedWorkdayHandoffUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], CAREER_PAGE_URL).toString()
      if (url === WORKDAY_BASE_URL) {
        return url
      }
    } catch {
      continue
    }
  }

  return null
}

export const buildJobsApiRequest = ({ offset = 0, limit = PAGE_SIZE, searchText = '' } = {}) =>
  JSON.stringify({
    appliedFacets: {
      locationCountry: [INDIA_LOCATION_COUNTRY],
    },
    limit,
    offset,
    searchText,
  })

const extractDetailPayload = async (url, fetchText) => {
  const html = await fetchText(url)
  const detail = await extractJobDetail({ provider: 'workday', html })

  return {
    locations: extractDetailLocations(html),
    employmentType: extractEmploymentType(html),
    ...detail,
  }
}

export const createRibbonCommunicationScraper = ({ pageSize = PAGE_SIZE } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREER_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Ribbon official careers page changed; refusing to guess the public jobs source')
    }

    const handoffUrl = extractVerifiedWorkdayHandoffUrl(careersHtml)
    if (handoffUrl !== WORKDAY_BASE_URL) {
      throw new Error('Ribbon verified Workday handoff changed; refusing to guess the public jobs source')
    }

    const workdayBoardHtml = await fetchText(WORKDAY_BASE_URL)
    assertWorkdayPageAvailable({ status: 200, html: workdayBoardHtml, url: WORKDAY_BASE_URL }, { source: SOURCE })
    if (!hasVerifiedWorkdayBoardSignal(workdayBoardHtml)) {
      throw new Error('Ribbon verified Workday board changed; refusing to scrape')
    }

    const payload = await fetchJson(WORKDAY_JOBS_API_URL, {
      method: 'POST',
      body: buildJobsApiRequest({ limit: pageSize }),
    })

    const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []
    const jobs = []

    for (const posting of postings) {
      const summaryLocation = normalizeWhitespace(posting?.locationsText)
      if (!isIndiaLocation(summaryLocation)) continue

      const sourceUrl = buildDetailUrl(posting?.externalPath)
      if (!sourceUrl) continue

      let detailPayload = emptyDetailPayload()
      try {
        detailPayload = await extractDetailPayload(sourceUrl, fetchText)
      } catch (error) {
        console.warn(`  [${SOURCE}] Failed to enrich ${sourceUrl}: ${error.message}`)
      }

      const primaryLocation = summaryLocation || detailPayload.locations[0] || null
      const city = extractCity(primaryLocation)
      const jobId = extractJobId(posting)
      const requisitionId = detailPayload.requisitionId || jobId

      jobs.push({
        jobId,
        title: normalizeWhitespace(posting?.title),
        company: COMPANY_NAME,
        department: detailPayload.department,
        location: primaryLocation,
        city,
        country: 'India',
        sourceUrl,
        applyUrl: buildApplyUrl(sourceUrl),
        employmentType: detailPayload.employmentType,
        experienceRequired: detailPayload.experienceRequired,
        minimumQualification: detailPayload.minimumQualification,
        preferredQualification: detailPayload.preferredQualification,
        requiredSkills: detailPayload.requiredSkills,
        postedAt: parsePostedOn(posting?.postedOn),
        closingDate: null,
        jobDescription: detailPayload.jobDescription,
        requisitionId,
        source: SOURCE,
        link: buildApplyUrl(sourceUrl),
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createRibbonCommunicationScraper().run(options)

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
