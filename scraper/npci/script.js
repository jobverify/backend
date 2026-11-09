import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createZohoNativeInventoryScraper } from '../../scraper-support/utils/zohoNativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PORTAL_URL = 'https://careers.npci.org.in/jobs/Careers'
export const COMPANY = 'National Payments Corporation of India'
export const SOURCE = 'npci'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const hasInputWithId = (html, id) => new RegExp(
  `<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`,
  'i',
).test(String(html ?? ''))

const extractHiddenInputValues = (html) => [...String(html ?? '').matchAll(
  /<input\b(?=[^>]*\btype=["']hidden["'])[^>]*\bvalue=(["'])([\s\S]*?)\1[^>]*>/gi,
)]
  .map((match) => decodeHtmlEntities(match[2]))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  || ''

const buildJobUrl = ({ id, title, rawUrl }) => {
  const sourceUrl = normalizeWhitespace(rawUrl)
  if (sourceUrl) return sourceUrl
  return `${CAREERS_PORTAL_URL}/${normalizeWhitespace(id) || ''}/${slugify(title)}?source=CareerSite`
}

const extractJobsPayload = (html) => {
  for (const value of extractHiddenInputValues(html)) {
    try {
      const payload = JSON.parse(value)
      if (!Array.isArray(payload) || payload.length === 0) continue
      if (!payload.some((record) =>
        record
        && typeof record === 'object'
        && ('Posting_Title' in record || 'Job_Opening_Name' in record)
      )) {
        continue
      }
      return payload
    } catch {
      continue
    }
  }

  return []
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State)
  const country = normalizeWhitespace(record.Country)
  const explicitLocation = normalizeWhitespace(record.Job_Location)
  const parts = [city, state, country].filter(Boolean)

  return {
    city,
    state,
    country,
    location: explicitLocation || (parts.length > 0 ? parts.join(', ') : null),
  }
}

const isIndiaRecord = (record = {}) => /india/i.test(
  [
    normalizeWhitespace(record.Country),
    normalizeWhitespace(record.Job_Location),
  ].filter(Boolean).join(' '),
)

const isPublishedRecord = (record = {}) => record.Publish !== false && record.Keep_on_Career_Site !== false

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*(?:Jobs|Openings)\s+at NPCI\s*<\/title>/i.test(page)
    && /https:\/\/careers\.npci\.org\.in\/jobs\/Careers/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && extractJobsPayload(page).length > 0
}

export const extractIndiaJobs = (html) => extractJobsPayload(html)
  .filter((record) => isPublishedRecord(record) && isIndiaRecord(record))
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = buildJobUrl({
      id: jobId,
      title,
      rawUrl: record.$url,
    })
    const { city, state, country, location } = normalizeLocation(record)

    if (!title || !jobId || !sourceUrl || !location || country !== 'India') return null

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(record.Department || record.Segment),
      location,
      city,
      state,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(record.Job_Type),
      experienceRequired: normalizeWhitespace(record.Work_Experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createNpciScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => createZohoNativeInventoryScraper({
  source: SOURCE, company: COMPANY, nativeCompany: 'National Payments Corporation of India (NPCI)', companyDomain: 'npci.org.in',
  boardUrl: CAREERS_PORTAL_URL, orgId: '190737000000336525', pageId: '190737000000336688',
  employerEntity: 'NPCI', excludedEntities: ['NIPL', 'NBSL', 'NBBL'], allowIndiaCityState: true,
}, { maxJobs: maxJobs ?? 0 })

export const run = async (options = {}) => createNpciScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
