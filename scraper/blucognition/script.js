import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import { BLUCOGNITION_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = BLUCOGNITION_CATALOG.source
export const COMPANY = BLUCOGNITION_CATALOG.companyName
export const CAREERS_URL = BLUCOGNITION_CATALOG.companyCareerPage
export const JOBS_API_URL = BLUCOGNITION_CATALOG.jobsApiUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const stripTags = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ul|ol|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(stripTags(value)) || null

const flattenDescription = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => flattenDescription(item)).filter(Boolean).join('\n')
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => flattenDescription(item)).filter(Boolean).join('\n')
  }

  return normalizeText(value)
}

const MONTH_INDEX_BY_NAME = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value).replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\s+([A-Za-z]+),\s+(\d{4})$/)
  if (!match) return null

  const [, day, monthName, year] = match
  const monthIndex = MONTH_INDEX_BY_NAME[monthName.toLowerCase()]
  if (!Number.isInteger(monthIndex)) return null

  return new Date(Date.UTC(Number(year), monthIndex, Number(day))).toISOString().slice(0, 10)
}

const inferCity = (location) => {
  const normalized = normalizeText(location)
  if (!normalized || /remote/i.test(normalized)) return null
  return normalizeText(normalized.split(',')[0])
}

const inferWorkplaceType = (job = {}) => {
  const locationCategory = normalizeText(job.locationCategory)
  if (locationCategory) return locationCategory

  const location = normalizeText(job.location)
  if (/remote/i.test(location ?? '')) return 'Remote'

  return null
}

const pickApplyUrl = (job = {}) =>
  normalizeText(job.linkedin) || normalizeText(job.naukri) || CAREERS_URL

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractActiveJobsFromCareersPayload = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => normalizeText(job?.status)?.toLowerCase() === 'active')
    .map((job) => {
      const title = normalizeText(job?.title)
      const location = normalizeText(job?.location)
      const applyUrl = pickApplyUrl(job)
      if (!title || !location) return null

      const description = [
        flattenDescription(job?.description_mini),
        flattenDescription(job?.description_details),
      ]
        .filter(Boolean)
        .join('\n\n')

      return {
        title,
        company: COMPANY,
        department: normalizeText(job?.department),
        location,
        city: inferCity(location),
        country: 'India',
        jobId: String(job?.id ?? ''),
        requisitionId: normalizeText(job?.requisition_id),
        sourceUrl: CAREERS_URL,
        applyUrl,
        employmentType: normalizeText(job?.type),
        workplaceType: inferWorkplaceType(job),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        openingsCount: Number.isFinite(Number(job?.openings)) ? Number(job.openings) : null,
        shift: normalizeText(job?.shift),
        postingDate: toIsoDate(job?.posted),
        closingDate: null,
        jobDescription: description || title,
      }
    })
    .filter(Boolean)

export const createBluCognitionScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchJson = defaultFetchJson, now: overrideNow } = {}) {
    const payload = await fetchJson(JOBS_API_URL)
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('The verified bluCognition careers feed no longer matches the trusted first-party JSON contract')
    }

    return extractActiveJobsFromCareersPayload(payload)
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        companyCareerPage: CAREERS_URL,
        source: SOURCE,
        companyDomain: BLUCOGNITION_CATALOG.companyDomain,
        atsPlatform: BLUCOGNITION_CATALOG.atsPlatform,
        link: job.applyUrl || CAREERS_URL,
        scrapedAt: (overrideNow || now)(),
      }))
  },
})

export const run = async (options = {}) => createBluCognitionScraper().run(options)

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
