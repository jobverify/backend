import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lumen'
export const COMPANY_NAME = 'Lumen Technologies'
export const HOMEPAGE_URL = 'https://www.lumen.com/en-us/home.html'
export const CAREERS_URL = 'https://careers.lumen.com/careers?sort_by=hot&start=0'
export const SEARCH_API_URL = 'https://careers.lumen.com/api/pcsx/search'
export const SEARCH_API_DOMAIN = 'lumen.com'
export const SEARCH_PAGE_SIZE = 50
export const VERIFIED_ON = '2026-08-03'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PAGE_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const SEARCH_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': USER_AGENT,
  'X-Requested-With': 'XMLHttpRequest',
  Referer: CAREERS_URL,
  Origin: 'https://careers.lumen.com',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html) => normalizeWhitespace(
  decodeHtmlEntities(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null),
)

const isIndiaLocation = (value) => {
  const normalized = normalizeText(value)
  return /india/i.test(normalized)
    || /,\s*in$/i.test(normalized)
    || /,\s*ind$/i.test(normalized)
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'
  return normalized.split(',')[0]?.trim() || null
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('onsite')) return 'On-site'
  return null
}

const formatUnixTimestamp = (value) => {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null

  try {
    return new Date(seconds * 1000).toISOString().slice(0, 10)
  } catch {
    return null
  }
}

const toAbsoluteCareerUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const buildSearchApiUrl = ({
  start = 0,
  limit = SEARCH_PAGE_SIZE,
  location = 'India',
} = {}) => {
  const url = new URL(SEARCH_API_URL)
  url.searchParams.set('domain', SEARCH_API_DOMAIN)
  url.searchParams.set('query', '')
  if (location) {
    url.searchParams.set('location', location)
  }
  url.searchParams.set('start', String(start))
  url.searchParams.set('limit', String(limit))
  return url.toString()
}

const normalizeLocation = (position = {}) => {
  const candidates = [
    ...(Array.isArray(position.locations) ? position.locations : []),
    ...(Array.isArray(position.standardizedLocations) ? position.standardizedLocations : []),
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)

  return candidates.find((value) => /india/i.test(value))
    || candidates.find((value) => /,\s*in$/i.test(normalizeText(value)))
    || candidates.find((value) => /,\s*ind$/i.test(normalizeText(value)))
    || candidates[0]
    || null
}

const buildJobCard = (position = {}) => {
  const title = normalizeWhitespace(position.name)
  const location = normalizeLocation(position)
  const locationCandidates = [
    location,
    ...(Array.isArray(position.standardizedLocations) ? position.standardizedLocations : []),
    ...(Array.isArray(position.locations) ? position.locations : []),
  ].filter(Boolean)

  if (!title || !location || !locationCandidates.some(isIndiaLocation)) {
    return null
  }

  const sourceUrl = toAbsoluteCareerUrl(position.positionUrl || `/careers/job/${position.id}`)
  const jobId = position.id ?? null
  const requisitionId = normalizeWhitespace(position.displayJobId || position.atsJobId || jobId)

  if (!sourceUrl || jobId == null || !requisitionId) {
    return null
  }

  const remoteStatus = normalizeRemoteStatus(position.workLocationOption)

  return {
    title,
    company: COMPANY_NAME,
    department: normalizeWhitespace(position.department),
    location,
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: position.postedTs ?? null,
    closingDate: null,
    jobDescription: null,
    ...(remoteStatus ? { remoteStatus } : {}),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const title = extractTitle(rawHtml) || ''
  const text = stripHtml(rawHtml) || ''

  return /AI-Ready Networking\s*&\s*Secure Cloud Solutions\s*\|\s*Lumen Technologies/i.test(title)
    && /AI-Ready Networking/i.test(text)
    && /Secure Cloud Solutions/i.test(text)
    && /Lumen Technologies/i.test(text)
}

const extractPcsxPayload = (html) => {
  const rawHtml = String(html ?? '')
  const match = rawHtml.match(/<code id="pcsx-data"[^>]*>([\s\S]*?)<\/code>/i)
  if (!match) return null

  try {
    return JSON.parse(decodeHtmlEntities(match[1]))
  } catch {
    return null
  }
}

export const hasVerifiedCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const title = extractTitle(rawHtml) || ''
  const pcsxPayload = extractPcsxPayload(rawHtml)

  return /Careers at Lumen Technologies/i.test(title)
    && (
      /window\._EF_GROUP_ID\s*=\s*"lumen\.com"/i.test(rawHtml)
      || pcsxPayload?.domain === 'lumen.com'
    )
    && /id=["']pcsx-data["']/i.test(rawHtml)
}

export const extractSearchResults = (payload) => (
  Array.isArray(payload?.data?.positions)
    ? payload.data.positions.map(buildJobCard).filter(Boolean)
    : []
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: PAGE_HEADERS,
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: SEARCH_HEADERS,
  label: `${SOURCE}-api`,
  timeoutMs: 15000,
})

export const createLumenScraper = ({
  now = () => new Date().toISOString(),
  pageSize = SEARCH_PAGE_SIZE,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Lumen verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('Lumen verified careers page no longer matches the known first-party jobs surface')
    }

    const jobs = []

    for (let start = 0; ; start += pageSize) {
      const payload = await fetchJson(buildSearchApiUrl({ start, limit: pageSize }))
      const pagePositions = Array.isArray(payload?.data?.positions) ? payload.data.positions : []
      jobs.push(...extractSearchResults(payload))

      const totalCount = Number(payload?.data?.count)
      if (pagePositions.length < pageSize) {
        break
      }

      if (Number.isFinite(totalCount) && start + pageSize >= totalCount) {
        break
      }
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      postingDate: formatUnixTimestamp(job.postingDate),
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createLumenScraper().run(options)

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
