import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FULCRUM_DIGITAL_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

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

const extractInputValue = (html, id) => {
  const match = new RegExp(
    `<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*\\bvalue=(["'])([\\s\\S]*?)\\1[^>]*>`,
    'i',
  ).exec(String(html ?? ''))

  return match ? decodeHtmlEntities(match[2]) : null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const buildJobSlug = (title) => encodeURIComponent(
  normalizeWhitespace(title)?.replace(/\s+/g, '-') ?? '',
)

const buildJobUrl = ({ id, title, rawUrl, listUrl } = {}) => {
  const sourceUrl = normalizeWhitespace(rawUrl)
  if (sourceUrl) return sourceUrl
  const baseUrl = normalizeWhitespace(listUrl) || JOBS_BOARD_URL
  return `${baseUrl}/${normalizeWhitespace(id) || ''}/${buildJobSlug(title)}?source=CareerSite`
}

const extractJobsPayload = (html = '') => {
  const rawPayload = extractInputValue(html, 'jobs')
  if (!rawPayload) return []

  try {
    const parsed = JSON.parse(rawPayload)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const extractMetaPayload = (html = '') => {
  for (const inputId of ['pageJson', 'meta', 'moduleMeta']) {
    const rawPayload = extractInputValue(html, inputId)
    if (!rawPayload) continue

    try {
      const parsed = JSON.parse(rawPayload)
      if (Array.isArray(parsed)) continue
      if (
        parsed
        && typeof parsed === 'object'
        && (
          Object.prototype.hasOwnProperty.call(parsed, 'company_name')
          || Object.prototype.hasOwnProperty.call(parsed, 'list_url')
        )
      ) {
        return parsed
      }
    } catch {
      // Continue until we find the hidden payload that carries the board metadata.
    }
  }

  return {}
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State)
  const country = normalizeWhitespace(record.Country)
  const location = [city, state, country].filter(Boolean).join(', ') || null

  return { location, city, state, country }
}

const normalizeRemoteStatus = (record = {}) => {
  if (record.Remote_Job === true) return 'Remote'
  if (record.Remote_Job === false) return 'On-site'
  return null
}

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

const isPublishedRecord = (record = {}) => record.Publish !== false

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')
  const meta = extractMetaPayload(page)
  const companyName = normalizeWhitespace(meta.company_name) || COMPANY
  const listUrl = normalizeWhitespace(meta.list_url) || JOBS_BOARD_URL

  return (/Jobs at Fulcrum Digital/i.test(page) || /<title>\s*Jobs at Careers\s*<\/title>/i.test(page))
    && page.includes(JOBS_BOARD_URL)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
    && companyName === COMPANY
    && listUrl === JOBS_BOARD_URL
}

export const extractIndiaJobs = (html = '') => {
  const listUrl = normalizeWhitespace(extractMetaPayload(html).list_url) || JOBS_BOARD_URL

  return extractJobsPayload(html)
    .filter((record) => isPublishedRecord(record) && isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = buildJobUrl({
        id: jobId,
        title,
        rawUrl: record.$url,
        listUrl,
      })
      const { location, city, state, country } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl || !location || country !== 'India') return null

      return {
        title,
        company: COMPANY,
        department: null,
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
        postingDate: normalizeWhitespace(record.Date_Opened),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: normalizeRemoteStatus(record),
      }
    })
    .filter(Boolean)
}

export const createFulcrumDigitalScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const portalHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('The verified Fulcrum Digital careers board no longer matches the trusted public surface')
    }

    const jobs = extractIndiaJobs(portalHtml)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createFulcrumDigitalScraper().run(options)

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
