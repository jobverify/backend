import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'chetu'
export const COMPANY = 'Chetu'
export const CAREERS_URL = 'https://careers.chetu.com/'
export const JOBS_API_URL = 'https://careers.chetu.com/data/fetch'
export const APPLICANT_URL_BASE = 'https://applicant.chetu.com/#/job/apply'
export const INDIA_TAB_CODE = 'IN'
export const INLINE_APPLY_ENCRYPTED_MASTER_JOB_ID = 'pW7eQclLZyaJw4JCcSKx8w=='

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_SIGNAL_PATTERNS = [
  /<title>\s*Chetu Careers \| IT Careers \| Software Engineer Careers\s*<\/title>/i,
  /\bUS Careers\b/i,
  /\bUK Careers\b/i,
  /\bIndia Careers\b/i,
  /id=['"]job-data-container['"]/i,
  /https:\/\/careers\.chetu\.com\/data\/fetch/i,
  /https:\/\/applicant\.chetu\.com\/#\/job\/apply/i,
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toStringId = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized ? String(normalized) : null
}

const toFiniteNumber = (value) => {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const extractCookieHeader = (response) => {
  const cookies = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : response.headers.get('set-cookie')
      ? [response.headers.get('set-cookie')]
      : []

  const cookieHeader = cookies
    .map((value) => String(value).split(';', 1)[0]?.trim())
    .filter(Boolean)
    .join('; ')

  return cookieHeader || null
}

const parseSkills = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^null$/i.test(normalized)) return []

  return normalized
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
}

const formatExperienceRequired = (minValue, maxValue) => {
  const min = toFiniteNumber(minValue)
  const max = toFiniteNumber(maxValue)

  if (min != null && max != null) return `${min}-${max} years`
  if (min != null) return `${min}+ years`
  if (max != null) return `Up to ${max} years`
  return null
}

const isIndiaRecord = (record = {}) => {
  const countryCode = normalizeWhitespace(record.job_country)?.toUpperCase()
  return !countryCode || countryCode === INDIA_TAB_CODE
}

export const hasOfficialCareersSignal = (html) =>
  OFFICIAL_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const extractCsrfToken = (html) =>
  normalizeWhitespace(String(html ?? '').match(/_token:\s*'([^']+)'/i)?.[1])

export const buildListingsRequestBody = (csrfToken, tab = INDIA_TAB_CODE) =>
  new URLSearchParams({
    tab,
    _token: csrfToken,
  })

export const buildApplyUrl = (record = {}) => {
  const inlineApplyUrl = normalizeWhitespace(record.job_apply_link) || CAREERS_URL
  const encryptedMasterJobId = normalizeWhitespace(record.encrypted_master_job_id)

  if (!encryptedMasterJobId || encryptedMasterJobId === INLINE_APPLY_ENCRYPTED_MASTER_JOB_ID) {
    return inlineApplyUrl
  }

  const encryptedCountryCode = normalizeWhitespace(record.encrypted_country_code)
  const encryptedJobName = normalizeWhitespace(record.encrypted_job_name)

  if (!encryptedCountryCode || !encryptedJobName) {
    return inlineApplyUrl
  }

  const params = new URLSearchParams({
    countryCode: encryptedCountryCode,
    masterJobId: encryptedMasterJobId,
    jobName: encryptedJobName,
  })

  return `${APPLICANT_URL_BASE}?${params.toString()}`
}

export const assertFeedPayload = (payload) => {
  if (!Array.isArray(payload?.data)) {
    throw new Error('Chetu first-party jobs feed no longer returns the verified public data array')
  }

  return payload.data
}

export const normalizeJob = (record, scrapedAt) => {
  if (!isIndiaRecord(record)) return null

  const title = normalizeWhitespace(record?.job_name)
  const jobId = toStringId(record?.MasterJobId ?? record?.id)
  const rawLocation = normalizeWhitespace(record?.job_location)
  const city = rawLocation ? normalizeCity(rawLocation) : null
  const applyUrl = buildApplyUrl(record)

  if (!title || !jobId) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(record?.job_type),
    location: rawLocation ? `${rawLocation}, India` : 'India',
    city,
    state: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_URL,
    applyUrl,
    employmentType: null,
    experienceRequired: formatExperienceRequired(record?.min_experiance, record?.max_experiance),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: parseSkills(record?.job_skills),
    postingDate: normalizeWhitespace(record?.created_at),
    closingDate: null,
    jobDescription: normalizeWhitespace(record?.job_description),
    source: SOURCE,
    link: applyUrl || CAREERS_URL,
    scrapedAt,
  }
}

export const extractListings = (payload) => assertFeedPayload(payload)
  .filter((record) => isIndiaRecord(record))

const defaultFetchSessionPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    html: await response.text(),
    cookieHeader: extractCookieHeader(response),
  }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createChetuScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchSessionPage = defaultFetchSessionPage,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const session = await fetchSessionPage(CAREERS_URL)

    if (!hasOfficialCareersSignal(session?.html)) {
      throw new Error('Chetu verified official careers surface no longer matches the known public page')
    }

    const csrfToken = extractCsrfToken(session.html)
    if (!csrfToken) {
      throw new Error('Missing Chetu careers CSRF token')
    }

    if (!normalizeWhitespace(session.cookieHeader)) {
      throw new Error('Missing Chetu careers session cookie required by the verified first-party jobs feed')
    }

    const payload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: CAREERS_URL,
        Cookie: session.cookieHeader,
      },
      body: buildListingsRequestBody(csrfToken),
    })

    const scrapedAt = now()
    const jobs = extractListings(payload)
      .map((record) => normalizeJob(record, scrapedAt))
      .filter(Boolean)

    return Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createChetuScraper(options).run(options)

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
