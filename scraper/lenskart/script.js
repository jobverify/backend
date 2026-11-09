import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { LENSKART_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LENSKART_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const BOARD_SLUG = PROVIDER_METADATA.boardSlug
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FOREIGN_LOCATION_PATTERN =
  /\b(uae|dubai|abu dhabi|singapore|japan|middle east|qatar|oman|kuwait|saudi)\b/i

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractBoardSlug = (html = '') =>
  String(html ?? '').match(/\bconst\s+slug\s*=\s*"([^"]+)"/i)?.[1] || null

export const hasOfficialBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Job Board\s*<\/title>/i.test(page)
    && normalized.includes('#DoMoreBeMore')
    && normalized.includes('Open Positions')
    && normalized.includes('0 jobs available')
    && normalized.includes('No jobs found')
    && normalized.includes('Powered by ainterviews.com')
    && Boolean(extractBoardSlug(page))
}

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  return !FOREIGN_LOCATION_PATTERN.test(normalized)
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (normalized.includes('/')) return null

  const tokens = normalized.split(',').map((token) => token.trim()).filter(Boolean)
  if (tokens.length === 0) return null

  let candidate = tokens[tokens.length - 1]
  if (/^india$/i.test(candidate) && tokens.length >= 2) {
    candidate = tokens[tokens.length - 2]
  }

  return normalizeCity(candidate) || candidate || null
}

const mapJob = (job, scrapedAt) => {
  const title = normalizeWhitespace(job?.title)
  const location = normalizeWhitespace(job?.location)
  const sourceUrl = toAbsoluteUrl(job?.apply_url)

  if (!title || !location || !sourceUrl || !isIndiaLocation(location)) {
    return null
  }

  return {
    title,
    company: COMPANY_NAME,
    department: normalizeWhitespace(job?.category),
    location,
    city: deriveCity(location),
    country: 'India',
    jobId: String(job?.id ?? '').trim() || null,
    requisitionId: String(job?.id ?? '').trim() || null,
    sourceUrl,
    applyUrl: sourceUrl,
    source: SOURCE,
    link: sourceUrl,
    employmentType: normalizeWhitespace(job?.job_type),
    experienceRequired: null,
    publicExperienceChecked: true,
    ...(normalizeWhitespace(job?.experience_level)
      ? { experienceLevel: normalizeWhitespace(job?.experience_level) }
      : {}),
    ...(normalizeWhitespace(job?.posted_date)
      ? { postingDate: normalizeWhitespace(job?.posted_date) }
      : {}),
    jobDescription: stripHtml(job?.description),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
    scrapedAt,
  }
}

export const createLenskartScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const boardHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialBoardSignal(boardHtml)) {
      throw new Error('Lenskart official board no longer matches the verified first-party surface')
    }

    const boardSlug = extractBoardSlug(boardHtml)
    if (boardSlug !== BOARD_SLUG) {
      throw new Error(`Lenskart verified board slug changed from ${BOARD_SLUG} to ${boardSlug}`)
    }

    const payload = await fetchJson(JOBS_API_URL)
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('Lenskart jobs API no longer returns the verified jobs array payload')
    }

    return payload.jobs
      .map((job) => mapJob(job, now()))
      .filter(Boolean)
  },
})

export const run = async (options = {}) => createLenskartScraper(options).run(options)

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
