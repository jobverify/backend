import { createNativeGreenhouseScraper, NATIVE_GREENHOUSE_PROFILES, nativeSourceMetadata } from '../../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import PROPHECY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROPHECY_CATALOG.source
export const COMPANY = PROPHECY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PROPHECY_CATALOG.officialBrandName
export const VERIFIED_ON = null
export const PROVIDER_METADATA = nativeSourceMetadata(NATIVE_GREENHOUSE_PROFILES["prophecy"], PROPHECY_CATALOG)
export const CAREERS_URL = PROPHECY_CATALOG.companyCareerPage
export const GREENHOUSE_DEPARTMENTS_API_URL = PROPHECY_CATALOG.greenhouseDepartmentsApiUrl
export const GREENHOUSE_JOB_BOARD_PREFIX = PROPHECY_CATALOG.greenhouseJobBoardPrefix

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
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

const isIndiaLocation = (value) => /\bIndia\b/i.test(normalizeWhitespace(value) || '')

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^remote\b/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const inferRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location) || ''
  if (/\bremote\b/i.test(normalized)) return 'Remote'
  if (/\bhybrid\b/i.test(normalized)) return 'Hybrid'
  return 'On-site'
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/\b(\d+)\s*[-–]\s*(\d+)\s*years?\b/i)
  if (rangeMatch) return `${rangeMatch[1]} - ${rangeMatch[2]} years`

  const plusMatch = normalized.match(/\b(\d+)\+\s*years?\b/i)
  if (plusMatch) return `${plusMatch[1]}+ years`

  const exactMatch = normalized.match(/\b(\d+)\s*years?\b/i)
  if (exactMatch) return `${exactMatch[1]} years`

  return null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Prophecy Careers \| The AI Data Analysis Platform\s*<\/title>/i.test(page)
    && /<link[^>]+href=["']https:\/\/www\.prophecy\.ai\/careers["'][^>]+rel=["']canonical["']/i.test(page)
    && /Come Transform Your Career With Us/i.test(page)
    && /\bOPEN POSITIONS\b/i.test(page)
    && /id=["']job-board-container["']/i.test(page)
    && /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/[a-z0-9-]+\/departments/i.test(page)
    && /\\?\$\{job\.absolute_url\}/i.test(page)
    && /\\?\$\{job\.location\}/i.test(page)
}

export const extractGreenhouseDepartmentsApiUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/[a-z0-9-]+\/departments/i,
  )

  return match?.[0] || null
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const normalizedId = normalizeWhitespace(jobId)
  if (!normalizedId) return null

  try {
    const url = new URL(String(value ?? ''))
    const expectedPath = `/prophecysimpledatalabs/jobs/${normalizedId}`
    if (url.hostname.replace(/^www\./i, '').toLowerCase() !== 'job-boards.greenhouse.io') return null
    if (url.pathname.replace(/\/+$/, '') !== expectedPath) return null

    url.hash = ''
    url.search = ''
    return url.toString()
  } catch {
    return null
  }
}

export const buildGreenhouseApplyUrl = (value, jobId) => {
  const sourceUrl = normalizeGreenhouseJobUrl(value, jobId)
  return sourceUrl ? `${sourceUrl}#application` : null
}

export const hasOfficialGreenhouseJobDetailSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*.+\s*-\s*Prophecy\s*<\/title>/i.test(page)
    && /<h1[^>]*>.+<\/h1>/i.test(page)
    && text.includes('experience')
  }

export const extractGreenhouseJobDetail = (html = '', listing = {}) => {
  const text = stripTags(html) || ''
  const experienceSnippet = text.match(
    /\b(?:\d+\s*[-–]\s*\d+\s*years?|\d+\+\s*years?|\d+\s*years?)\b[^.]{0,140}\bexperience\b/i,
  )?.[0]

  return {
    ...listing,
    experienceRequired: normalizeExperience(experienceSnippet) || listing.experienceRequired || null,
  }
}

export const enrichIndiaJobsWithGreenhouseDetails = async (jobs, fetchText = defaultFetchText) => Promise.all(
  jobs.map(async (job) => {
    try {
      const detailHtml = await fetchText(job.sourceUrl)
      if (!hasOfficialGreenhouseJobDetailSignal(detailHtml)) return job
      return extractGreenhouseJobDetail(detailHtml, job)
    } catch {
      return job
    }
  }),
)

export const extractIndiaJobsFromDepartmentsPayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const departments = Array.isArray(payload?.departments) ? payload.departments : null
  if (!departments) {
    throw new Error('Verified Prophecy Greenhouse departments payload changed materially')
  }

  return departments
    .flatMap((department) => {
      const departmentName = normalizeWhitespace(department?.name)
      const jobs = Array.isArray(department?.jobs) ? department.jobs : []

      return jobs.map((job) => ({
        departmentName,
        job,
      }))
    })
    .filter(({ job }) => isIndiaLocation(job?.location?.name))
    .map(({ departmentName, job }) => {
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const location = normalizeWhitespace(job?.location?.name)
      const jobId = normalizeWhitespace(job?.id)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, jobId)
      const applyUrl = buildGreenhouseApplyUrl(job?.absolute_url, jobId)

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('Verified Prophecy Greenhouse departments payload changed materially')
      }

      if (!title || !location || !jobId || !sourceUrl || !applyUrl) {
        throw new Error('Verified Prophecy Greenhouse departments payload changed materially')
      }

      return {
        title,
        company: COMPANY,
        department: departmentName,
        location,
        city: deriveCity(location),
        country: 'India',
        jobId,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        sourceUrl,
        applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.first_published || job?.updated_at),
        closingDate: null,
        jobDescription: null,
        remoteStatus: inferRemoteStatus(location),
        source: SOURCE,
        link: sourceUrl,
        scrapedAt,
      }
    })
}

export const createProphecyScraper = (defaults = {}) => createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES["prophecy"], defaults)

export const run = options => createNativeGreenhouseScraper(NATIVE_GREENHOUSE_PROFILES["prophecy"]).run(options)

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
