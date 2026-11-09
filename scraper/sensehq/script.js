import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import SENSEHQ_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_ROOT_URL = 'https://sensehr.sensehq.com/careers/'

export const PROVIDER_METADATA = SENSEHQ_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.verifiedJobsPageUrl

const stripHtmlComments = (value) => String(value ?? '').replace(/<!--[\s\S]*?-->/g, '')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractNextDataPayload = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )

  if (!match) {
    throw new Error('SenseHQ verified jobs payload no longer exposes __NEXT_DATA__')
  }

  try {
    return JSON.parse(match[1])
  } catch {
    throw new Error('SenseHQ verified jobs payload is no longer valid JSON')
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null

  if (normalized === 'FULLTIME' || normalized === 'FULL_TIME') return 'Full-time'
  if (normalized === 'PARTTIME' || normalized === 'PART_TIME') return 'Part-time'
  if (normalized === 'CONTRACT') return 'Contract'
  if (normalized === 'INTERN' || normalized === 'INTERNSHIP') return 'Internship'
  return normalizeWhitespace(value)
}

const toIsoDate = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null

  const parsed = new Date(numeric)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const isIndiaJob = (record = {}) => {
  const officeCountry = normalizeWhitespace(record.office?.country)
  if (officeCountry?.toLowerCase() === 'india') return true

  const locationText = [
    normalizeWhitespace(record.location),
    normalizeWhitespace(record.office?.city),
    normalizeWhitespace(record.office?.name),
  ]
    .filter(Boolean)
    .join(' ')

  return /\bindia\b/i.test(locationText)
}

const buildLocation = (record = {}) => {
  const rawLocation = normalizeWhitespace(record.location || record.office?.city || record.office?.name)
  if (!rawLocation) {
    return { location: null, city: null }
  }

  if (/remote/i.test(rawLocation)) {
    return {
      location: 'Remote, India',
      city: null,
    }
  }

  return {
    location: `${rawLocation}, India`,
    city: rawLocation,
  }
}

const buildRemoteStatus = (record = {}, location = '') => {
  const workplaceType = normalizeWhitespace(record.workplace_type)
  if (/hybrid/i.test(workplaceType || '') || /hybrid/i.test(location || '')) return 'Hybrid'
  if (/remote/i.test(workplaceType || '') || /remote/i.test(location || '')) return 'Remote'
  return 'On-site'
}

const buildExperienceRequired = (record = {}) => {
  const start = Number(record.experience_start)
  const end = Number(record.experience_end)

  if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start) {
    return `${start}-${end} years`
  }

  if (Number.isFinite(start) && start > 0) {
    return `${start}+ years`
  }

  const description = stripHtml(record.description_external)
  const rangeMatch = description?.match(/\b(\d+\s*(?:-|to)\s*\d+)\s*years?\b/i)
  if (rangeMatch) {
    return `${normalizeWhitespace(rangeMatch[1])} years`
  }

  const plusMatch = description?.match(/\b(\d+)\+\s*years?\b/i)
  if (plusMatch) {
    return `${normalizeWhitespace(plusMatch[1])}+ years`
  }

  return null
}

export const hasVerifiedJobsBoardSignal = (html = '') => {
  const page = stripHtmlComments(html)

  return /<title[^>]*>\s*Job openings at Sense HQ\s*<\/title>/i.test(page)
    && /Job openings at Sense HQ/i.test(page)
    && /id=["']__NEXT_DATA__["']/i.test(page)
}

export const buildJobUrl = (jobId) =>
  new URL(`jobs/${encodeURIComponent(String(jobId ?? '').trim())}`, CAREERS_ROOT_URL).toString()

export const extractBoardJobs = (html = '') => {
  const payload = extractNextDataPayload(html)
  const jobsData = payload?.props?.pageProps?.jobsData
  const jobs = Array.isArray(jobsData?.rows)
    ? jobsData.rows
    : Array.isArray(jobsData?.jobs)
      ? jobsData.jobs
      : null

  if (!Array.isArray(jobs)) {
    throw new Error('Verified SenseHQ jobs payload no longer exposes the expected jobs array or rows array')
  }

  return jobs
}

export const extractIndiaJobsFromBoardHtml = (
  html,
  { scrapedAt = new Date().toISOString() } = {},
) => extractBoardJobs(html)
  .filter((record) => normalizeWhitespace(record.job_status)?.toUpperCase() === 'OPEN')
  .filter((record) => isIndiaJob(record))
  .map((record) => {
    const title = normalizeWhitespace(record.title)
    const jobId = normalizeWhitespace(record.id)
    const requisitionId = normalizeWhitespace(record.code) || jobId
    const { location, city } = buildLocation(record)
    const sourceUrl = buildJobUrl(jobId)

    if (!title || !jobId || !location) return null

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(record.department),
      location,
      city,
      country: 'India',
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(record.job_type),
      experienceRequired: buildExperienceRequired(record),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDate(record.created_on),
      closingDate: null,
      jobDescription: stripHtml(record.description_external),
      remoteStatus: buildRemoteStatus(record, location),
      source: SOURCE,
      link: sourceUrl,
      scrapedAt,
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'sensehq-html',
  timeoutMs: 15000,
})

export const createSensehqScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const boardHtml = await fetchText(JOBS_BOARD_URL)

    if (!hasVerifiedJobsBoardSignal(boardHtml)) {
      throw new Error('Verified SenseHQ jobs board changed materially')
    }

    return extractIndiaJobsFromBoardHtml(boardHtml, {
      scrapedAt: now(),
    })
  },
})

export const run = async (options = {}) => createSensehqScraper(options).run(options)

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
