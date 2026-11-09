import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { shouldContinueWorkdayJobsApiPagination } from '../../scraper-support/myworkday/engine.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { HOTSTAR_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HOTSTAR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_KEYWORD = PROVIDER_METADATA.verifiedKeyword
export const VERIFIED_JOB_URL = PROVIDER_METADATA.verifiedJobUrl
export const VERIFIED_APPLY_URL = PROVIDER_METADATA.verifiedApplyUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const PAGE_SIZE = 20
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const HOMEPAGE_ACCEPTED_URLS = [
  HOMEPAGE_URL,
  'https://www.hotstar.com/in',
  'https://www.hotstar.com/in/',
]

const WORKDAY_BOARD_ACCEPTED_URLS = [
  WORKDAY_BOARD_URL,
  'https://jiostar.wd102.myworkdayjobs.com/JioStar/',
  'https://jiostar.wd102.myworkdayjobs.com/en-US/JioStar',
  'https://jiostar.wd102.myworkdayjobs.com/en-US/JioStar/',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
  .replace(/&#x([0-9a-f]+);/gi, (_, hexCodePoint) => String.fromCodePoint(parseInt(hexCodePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const isAcceptedHomepageUrl = (value) =>
  HOMEPAGE_ACCEPTED_URLS.some((candidate) => sameUrl(value, candidate))

const isAcceptedWorkdayBoardUrl = (value) =>
  WORKDAY_BOARD_ACCEPTED_URLS.some((candidate) => sameUrl(value, candidate))

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

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'content-type': 'application/json',
  },
  body,
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const normalizedHomepage = normalized.replace(/\u2019/g, "'")

  if (
    /<title>\s*JioHotstar\s*-\s*Watch TV Shows, Movies, Specials, Live Cricket\s*&amp;\s*Football\s*<\/title>/i.test(page)
    && /JioHotstar is India's largest premium streaming platform/i.test(normalizedHomepage)
  ) {
    return true
  }

  return (
    (
      /<title>\s*JioHotstar\s*-\s*Watch TV Shows, Movies, Specials, Live Cricket\s*&amp;\s*Football\s*<\/title>/i.test(page)
      && /JioHotstar is India(?:'|â€™|&#8217;|Ã¢â‚¬â„¢)?s largest premium streaming platform/i.test(normalized)
    )
    || (
      /Looks like you are connecting through a VPN, proxy or 'unblocker' service\./i.test(page)
      && /Cookie Settings/i.test(page)
    )
  )
}

export const hasBlockedJiostarCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Error\s*<\/title>/i.test(page)
    && normalized.includes('An error occurred while processing your request.')
    && /errors\.edgesuite\.net/i.test(normalized)
    && /Reference\s+#/i.test(normalized)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const normalizedTitlePage = page.replace(/\u2019/g, "'")

  return /<title>\s*JioStar\s*-\s*India(?:'|â€™|&#8217;|Ã¢â‚¬â„¢)?s Largest Media Conglomerate\s*\|\s*Entertainment Reimagined\s*<\/title>/i.test(normalizedTitlePage)
    && /jiostar\.wd102\.myworkdayjobs\.com\/JioStar/i.test(page)
    && (
      /Jio Hotstar streaming platform/i.test(normalized)
      || /Perched firmly at the nucleus of spellbinding content/i.test(normalized)
      || /# JioStar/i.test(page)
    )
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isAcceptedWorkdayBoardUrl(match[1])) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (page = {}) => {
  const html = String(page.html ?? '')
  const finalUrl = getFinalUrl(page, WORKDAY_BOARD_URL)

  return Number(page.status) === 200
    && isAcceptedWorkdayBoardUrl(finalUrl)
    && /rel=["']canonical["'][^>]*href=["']https:\/\/jiostar\.wd102\.myworkdayjobs\.com\/JioStar["']/i.test(html)
    && /window\.workday\s*=\s*window\.workday/i.test(html)
    && /tenant:\s*"jiostar"/i.test(html)
    && /siteId:\s*"JioStar"/i.test(html)
    && /appName:\s*"cxs"/i.test(html)
}

export const buildKeywordSearchRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: VERIFIED_KEYWORD,
})

const extractJobId = (posting = {}) => {
  const bulletFieldJobId = (Array.isArray(posting?.bulletFields) ? posting.bulletFields : [])
    .find((value) => /^JR\d+$/i.test(String(value)))

  if (bulletFieldJobId) return bulletFieldJobId

  return String(posting?.externalPath ?? '').match(/_(JR\d+)(?:\/)?$/i)?.[1] || null
}

const extractPrimaryLocationSegment = (externalPath) =>
  String(externalPath ?? '').match(/\/job\/([^/]+)\//i)?.[1] ?? null

const extractPrimaryCity = (posting = {}) => {
  const locationText = normalizeWhitespace(posting?.locationsText)
  const rawSegment = normalizeWhitespace(
    decodeURIComponent(extractPrimaryLocationSegment(posting?.externalPath) ?? '').replace(/\+/g, ' '),
  )

  const locationCandidate = locationText
    ? locationText.split(/\s+-\s+/)[0]
    : rawSegment?.split('---')[0]

  return normalizeCity(locationCandidate) || null
}

const normalizeIndiaLocation = (posting = {}) => {
  const city = extractPrimaryCity(posting)

  return {
    location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
    city,
    state: null,
    country: COUNTRY_FILTER,
  }
}

const buildDetailUrl = (externalPath) => {
  const normalized = String(externalPath ?? '')
  if (!normalized) return null

  try {
    if (/^https?:\/\//i.test(normalized)) {
      return normalized.split('?')[0]
    }

    if (normalized.startsWith('/')) {
      return `${WORKDAY_BOARD_URL}${normalized}`.split('?')[0]
    }

    return new URL(normalized, `${WORKDAY_BOARD_URL}/`).toString().split('?')[0]
  } catch {
    return null
  }
}

const buildApplyUrl = (externalPath) => {
  const detailUrl = buildDetailUrl(externalPath)
  return detailUrl ? `${detailUrl}/apply` : null
}

const normalizePosting = (posting = {}, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const jobId = extractJobId(posting)
  const sourceUrl = buildDetailUrl(posting?.externalPath)
  const applyUrl = buildApplyUrl(posting?.externalPath)
  const locationBits = normalizeIndiaLocation(posting)

  if (!title || !jobId || !sourceUrl || !applyUrl || !locationBits.location) {
    throw new Error('Hotstar verified Workday jobs payload changed materially')
  }

  return {
    jobId,
    title,
    company: COMPANY_NAME,
    department: null,
    location: locationBits.location,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    sourceUrl,
    applyUrl,
    employmentType: normalizeWhitespace(posting?.timeType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(posting?.postedOn),
    closingDate: null,
    jobDescription: null,
    requisitionId: jobId,
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

export const extractJobsFromPayload = (payload = {}, scrapedAt) =>
  (Array.isArray(payload?.jobPostings) ? payload.jobPostings : [])
    .map((posting) => normalizePosting(posting, scrapedAt))

export const createHotstarScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const homepagePage = await fetchPage(HOMEPAGE_URL)
    if (
      homepagePage.status !== 200
      || !isAcceptedHomepageUrl(homepagePage.url)
      || !hasOfficialHomepageSignal(homepagePage.html)
    ) {
      throw new Error('Hotstar verified homepage surface changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    const hasVerifiedBlockedCareersPage = careersPage.status === 403
      && sameUrl(careersPage.url, CAREERS_URL)
      && hasBlockedJiostarCareersSignal(careersPage.html)
    const hasVerifiedLiveCareersPage = careersPage.status === 200
      && sameUrl(careersPage.url, CAREERS_URL)
      && hasOfficialCareersSignal(careersPage.html)

    if (!hasVerifiedBlockedCareersPage && !hasVerifiedLiveCareersPage) {
      throw new Error('Hotstar verified JioStar careers surface changed materially')
    }

    if (hasVerifiedLiveCareersPage) {
      const verifiedWorkdayBoardUrl = extractVerifiedWorkdayBoardUrl(careersPage.html)
      if (!sameUrl(verifiedWorkdayBoardUrl, WORKDAY_BOARD_URL)) {
        throw new Error('Hotstar verified Workday careers handoff changed materially')
      }
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoardPage, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (!hasOfficialWorkdayBoardSignal(workdayBoardPage)) {
      throw new Error('Hotstar verified public Workday board changed materially')
    }

    const scrapedAt = now()
    const jobs = []
    const seenJobIds = new Set()
    let offset = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(
        JOBS_API_URL,
        buildKeywordSearchRequestBody({ offset }),
      )
      const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []

      if (page === 1 && postings.length === 0) {
        return []
      }

      for (const job of extractJobsFromPayload(payload, scrapedAt)) {
        if (seenJobIds.has(job.jobId)) continue

        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      offset += postings.length
      if (maxJobs && jobs.length >= maxJobs) {
        return jobs.slice(0, maxJobs)
      }

      if (!shouldContinueWorkdayJobsApiPagination({
        jobsCount: postings.length,
        offsetAfterPage: offset,
        payloadTotal: payload?.total || 0,
        pageSize: PAGE_SIZE,
      })) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createHotstarScraper(options).run(options)

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
