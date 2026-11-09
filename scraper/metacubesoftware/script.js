import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

import { METACUBE_SOFTWARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REQUEST_TIMEOUT_MS = 20000
const PROFESSIONALS_PAGE_SIZE = 6
const PROFESSIONALS_APPLY_FALLBACK_URL = 'https://metacube.com/open-position-form.php'

export const PROVIDER_METADATA = METACUBE_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_HUB_URL = PROVIDER_METADATA.careersHubUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/â€¢|â—|â–ª|â€¢/g, '- ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|article|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeMultilineText = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\r/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|article|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized || null
}

const createTimeoutSignal = (timeoutMs) => {
  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const fetchResponseWithRetry = (url, {
  method = 'GET',
  headers = {},
  body,
  label = SOURCE,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) => withRetry(async () => {
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: createTimeoutSignal(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label,
})

const readHtmlPage = async (url) => {
  const response = await fetchResponseWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
  })

  return {
    html: await response.text(),
    setCookie: response.headers.get('set-cookie') || '',
  }
}

const normalizeSetCookieHeader = (value) => String(value ?? '')
  .split(/,(?=\s*[^;]+=)/)
  .map((item) => item.split(';')[0].trim())
  .filter(Boolean)
  .join('; ')

export const hasOfficialCareersHubSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Metacube\s*\|\s*Careers\s*<\/title>/i.test(page)
    && /EXPERIENCED PROFESSIONALS/i.test(page)
    && /STUDENTS\s*&\s*GRADUATES/i.test(page)
    && /Open Positions/i.test(page)
    && /General Application/i.test(page)
    && /What Makes a Metacubian\?/i.test(page)
}

export const hasOfficialProfessionalsPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Metacube\s*\|\s*Careers Professionals\s*<\/title>/i.test(page)
    && /Experienced Professionals/i.test(page)
    && /include\/students\.php\?type=load&id=2/i.test(page)
    && /id="jobTitle"/i.test(page)
    && /id="jobDescription"/i.test(page)
    && /Apply With Naukri\.Com|open-position-form\.php/i.test(page)
}

export const extractSessionToken = (html = '') => {
  const inputTag = String(html ?? '').match(/<input[^>]*id\s*=\s*["']token["'][^>]*>/i)?.[0]
    || String(html ?? '').match(/<input[^>]*value\s*=\s*["'][^"']+["'][^>]*id\s*=\s*["']token["'][^>]*>/i)?.[0]
    || ''

  return inputTag.match(/value\s*=\s*["']([^"']+)["']/i)?.[1] || null
}

export const hasProfessionalJobsFeedSignal = (payload = {}) => {
  const records = Array.isArray(payload?.Records) ? payload.Records : []
  const count = Number.parseInt(String(payload?.count ?? records.length), 10)

  if (payload?.Result !== 'OK' || !Number.isFinite(count) || count < records.length || records.length === 0) {
    return false
  }

  return records.every((record) =>
    Number.isFinite(Number(record?.ID))
    && normalizeWhitespace(record?.TITLE)
    && (normalizeWhitespace(record?.SHORT_DESCRIPTION) || normalizeMultilineText(record?.LONG_DESCRIPTION)),
  )
}

const extractLabeledValue = (text, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(text ?? '').match(new RegExp(`${escapedLabel}\\s*:?\\s*([^\\n]+)`, 'i'))
  return normalizeWhitespace(match?.[1])
}

const normalizeUrl = (value, fallback = null) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return fallback

  try {
    return new URL(normalized, 'https://metacube.com/').toString()
  } catch {
    return fallback
  }
}

export const normalizeProfessionalRecord = (record = {}, scrapedAt = new Date().toISOString()) => {
  const detailText = normalizeMultilineText(record.LONG_DESCRIPTION)
  const title = extractLabeledValue(detailText, 'Position') || normalizeWhitespace(record.TITLE)
  const shortDescription = normalizeWhitespace(record.SHORT_DESCRIPTION)
  const experienceRequired = extractLabeledValue(detailText, 'Experience') || normalizeWhitespace(record.EXPERIENCE)
  const workLocation = extractLabeledValue(detailText, 'Work Location')
    || normalizeWhitespace(record.WORK_LOCATION)
    || (normalizeWhitespace(record.CONTACT_PERSON)?.includes('@') ? null : normalizeWhitespace(record.CONTACT_PERSON))
  const minimumQualification = extractLabeledValue(detailText, 'Education')
  const applyUrl = normalizeUrl(record.APPLY_LINK, PROFESSIONALS_APPLY_FALLBACK_URL)
  const requisitionId = normalizeWhitespace(record.ID)

  if (!title || !requisitionId) return null

  const location = workLocation ? `${workLocation}, India` : 'India'
  const jobDescription = [shortDescription, detailText]
    .filter(Boolean)
    .join('\n\n')

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: workLocation || null,
    country: 'India',
    jobId: `${SOURCE}-${requisitionId}`,
    requisitionId,
    sourceUrl: CAREERS_URL,
    applyUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(record.DATE),
    closingDate: null,
    jobDescription: jobDescription || shortDescription || detailText,
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

const defaultFetchCareersHub = async () => (await readHtmlPage(CAREERS_HUB_URL)).html

const defaultFetchProfessionalsSession = async () => {
  const { html, setCookie } = await readHtmlPage(CAREERS_URL)

  return {
    html,
    token: extractSessionToken(html),
    cookies: normalizeSetCookieHeader(setCookie),
  }
}

const defaultFetchProfessionalsFeed = async ({ token, cookies, limit = PROFESSIONALS_PAGE_SIZE, offset = 0 } = {}) => {
  const response = await fetchResponseWithRetry(JOBS_API_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: CAREERS_URL,
      Origin: 'https://metacube.com',
      token,
      Cookie: cookies,
    },
    body: new URLSearchParams({
      limit: String(limit),
      ID: String(offset),
    }),
    label: `${SOURCE}-feed`,
  })

  return JSON.parse(await response.text())
}

export const createMetacubeSoftwareScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchCareersHub = defaultFetchCareersHub,
    fetchProfessionalsSession = defaultFetchProfessionalsSession,
    fetchProfessionalsFeed = defaultFetchProfessionalsFeed,
  } = {}) {
    const careersHubHtml = await fetchCareersHub(CAREERS_HUB_URL)
    if (!hasOfficialCareersHubSignal(careersHubHtml)) {
      throw new Error('The verified Metacube Software careers hub no longer matches the trusted first-party page')
    }

    const session = await fetchProfessionalsSession(CAREERS_URL)
    if (!hasOfficialProfessionalsPageSignal(session.html)) {
      throw new Error('The verified Metacube Software professionals page no longer matches the trusted first-party openings surface')
    }

    if (!session.token || !session.cookies) {
      throw new Error('The verified Metacube Software professionals page no longer exposes the session token and cookie needed for the first-party jobs feed')
    }

    const allRecords = []
    const seenIds = new Set()
    let offset = 0
    let totalCount = null

    while (totalCount == null || offset < totalCount) {
      const payload = await fetchProfessionalsFeed({
        token: session.token,
        cookies: session.cookies,
        limit: PROFESSIONALS_PAGE_SIZE,
        offset,
      })

      if (!hasProfessionalJobsFeedSignal(payload)) {
        throw new Error('The verified Metacube Software professionals feed no longer matches the trusted first-party jobs contract')
      }

      totalCount = Number.parseInt(String(payload.count ?? 0), 10)

      for (const record of payload.Records) {
        const key = String(record?.ID ?? '').trim()
        if (!key || seenIds.has(key)) continue
        seenIds.add(key)
        allRecords.push(record)
      }

      if (payload.Records.length === 0) {
        break
      }

      offset += payload.Records.length
    }

    const scrapedAt = String(now())
    return allRecords
      .map((record) => normalizeProfessionalRecord(record, scrapedAt))
      .filter(Boolean)
  },
})

export const run = async (options = {}) => createMetacubeSoftwareScraper(options).run(options)

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
