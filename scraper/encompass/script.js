import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import ENCOMPASS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ENCOMPASS_CATALOG.source
export const COMPANY = ENCOMPASS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ENCOMPASS_CATALOG.officialBrandName
export const VERIFIED_ON = ENCOMPASS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ENCOMPASS_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ENCOMPASS_CATALOG
export const HOMEPAGE_URL = ENCOMPASS_CATALOG.homepageUrl
export const CAREERS_ENTRY_URL = ENCOMPASS_CATALOG.careersEntryUrl
export const CAREERS_PAGE_URL = ENCOMPASS_CATALOG.careersPageUrl
export const ACCEPTED_CAREERS_URLS = [
  'https://www.encompasscorporation.com/careers',
  'https://www.encompasscorporation.com/careers/',
]
export const PINPOINT_BOARD_URL = ENCOMPASS_CATALOG.officialPinpointBoardUrl
export const PINPOINT_POSTINGS_URL = ENCOMPASS_CATALOG.pinpointPostingsUrl
export const PINPOINT_RSS_URL = ENCOMPASS_CATALOG.pinpointRssUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEFAULT_JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
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

const normalizeUrl = (value, baseUrl = PINPOINT_BOARD_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return normalized
  }
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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: DEFAULT_JSON_HEADERS,
  label: SOURCE,
  timeoutMs: 15000,
})

const isAcceptedCareersUrl = (value) =>
  ACCEPTED_CAREERS_URLS.some((candidate) => sameUrl(value, candidate))

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s*,\s*/)[0] || null

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const toIsoDateTime = (value) => {
  const timestamp = Date.parse(String(value ?? ''))
  if (Number.isNaN(timestamp)) return null
  return new Date(timestamp).toISOString()
}

const isIndiaLocation = (value) => /(^|[\s,/-])india\b/i.test(normalizeWhitespace(value) || '')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return extractTitle(page) === 'Corporate Digital Identity | CDI & KYC | Encompass Corporation'
    && text.includes('corporate digital identity')
    && (
      text.includes('cdi & kyc automation')
      || text.includes('process automation and cdi profiles')
    )
}

export const extractPinpointBoardUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/encompass\.pinpointhq\.com\/?#js-careers-jobs-block)["']/i)
  if (!match?.[1]) return null

  try {
    return `${new URL(match[1]).origin}/`
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Work for us \| Careers at Encompass \| KYC automation software\s*<\/title>/i.test(page)
    && text.includes('explore our latest vacancies')
    && sameUrl(extractPinpointBoardUrl(page), PINPOINT_BOARD_URL)
}

export const extractPinpointPostingsUrl = (html) => {
  const match = String(html ?? '').match(/["'](\/postings\.json)["']/i)
  return match?.[1] ? normalizeUrl(match[1], PINPOINT_BOARD_URL) : null
}

export const hasOfficialPinpointBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Jobs at Encompass Corporation \| Encompass Corporation Careers\s*<\/title>/i.test(page)
    && text.includes('there are currently no positions advertised.')
    && text.includes('register your interest')
    && /External::Jobs/i.test(page)
    && sameUrl(extractPinpointPostingsUrl(page), PINPOINT_POSTINGS_URL)
    && /https:\/\/encompass\.pinpointhq\.com\/jobs\.rss/i.test(page)
}

export const mapPinpointPosting = (posting = {}) => {
  const title = normalizeWhitespace(posting.title)
  const jobId = normalizeWhitespace(posting.id)
  const location = normalizeWhitespace(
    posting.location?.name
      || posting.location?.city
      || posting.location_text
      || posting.location,
  )
  const sourceUrl = normalizeUrl(
    posting.path
      || posting.url
      || posting.absolute_url,
    PINPOINT_BOARD_URL,
  )

  if (!title || !jobId || !location || !sourceUrl) {
    throw new Error('Encompass Pinpoint postings payload no longer exposes the verified fields')
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(posting.department?.name || posting.team?.name),
    location,
    city: extractCity(location),
    country: isIndiaLocation(location) ? 'India' : null,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(posting.employment_type_text || posting.employment_type),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: toIsoDateTime(posting.created_at || posting.createdAt || posting.published_at),
    closingDate: null,
    jobDescription: normalizeWhitespace(posting.description || posting.description_plain || posting.summary),
    remoteStatus: toRemoteStatus(posting.workplace_type_text || posting.workplace_type),
  }
}

export const extractPinpointJobs = (postings = []) => {
  const items = Array.isArray(postings)
    ? postings
    : (Array.isArray(postings?.data) ? postings.data : null)

  if (!items) {
    throw new Error('Encompass Pinpoint postings payload no longer returns an array')
  }

  return items
    .map((posting) => mapPinpointPosting(posting))
    .filter((job) => isIndiaLocation(job.location) || job.country === 'India')
}

export const createEncompassScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Encompass verified official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_ENTRY_URL)
    if (
      careersPage.status !== 200
      || !isAcceptedCareersUrl(careersPage.url)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Encompass verified careers page no longer matches the known first-party handoff surface')
    }

    if (!sameUrl(extractPinpointBoardUrl(careersPage.html), PINPOINT_BOARD_URL)) {
      throw new Error('Encompass verified careers page no longer links to the verified Pinpoint board')
    }

    const pinpointBoard = await fetchPage(PINPOINT_BOARD_URL)
    if (
      pinpointBoard.status !== 200
      || !sameUrl(pinpointBoard.url, PINPOINT_BOARD_URL)
      || !hasOfficialPinpointBoardSignal(pinpointBoard.html)
    ) {
      throw new Error('Encompass verified Pinpoint board changed materially')
    }

    if (!sameUrl(extractPinpointPostingsUrl(pinpointBoard.html), PINPOINT_POSTINGS_URL)) {
      throw new Error('Encompass verified Pinpoint board no longer advertises the verified postings feed')
    }

    const scrapedAt = now()

    return extractPinpointJobs(await fetchJson(PINPOINT_POSTINGS_URL)).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      companyCareerPage: CAREERS_PAGE_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createEncompassScraper().run(options)

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
