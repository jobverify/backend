import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchJsonWithRetry,
  fetchTextWithRetry,
} from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mediatek'
export const COMPANY = 'MediaTek'
export const BASE_URL = 'https://careers.mediatek.com'
export const HOMEPAGE_URL = `${BASE_URL}/en/jobs`
export const CAREERS_PAGE_URL = `${BASE_URL}/en/jobs`
export const JOBS_API_URL = `${BASE_URL}/api/trpc/job.getJobs`
export const COMPANY_DOMAIN = 'careers.mediatek.com'
export const ATS_PLATFORM = 'nextjs-trpc-job-api'
export const VERIFIED_ON = '2026-08-03'
export const JOBS_PAGE_SIZE = 100
export const INDIA_LOCATION_CODES = ['0000168800', '0000009297', '9021']

const DETAIL_PAGE_BASE_URL = `${BASE_URL}/en/jobs/`
const JOB_ID_PATTERN = /^[A-Z]{3,4}\d{9,}$/i
const LOCALE_COOKIE = 'NEXT_LOCALE=en'
const API_LOCALE = 'en_US'
const INDIA_LOCATION_CODE_SET = new Set(INDIA_LOCATION_CODES)
const INDIA_CITY_SET = new Set(['bangalore', 'bengaluru', 'mumbai', 'noida'])
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeMultilineText = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\t+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized || null
}

const normalizeCity = (value) => normalizeWhitespace(value)?.replace(/\s+/g, ' ') || null

const buildJobQueryInfo = (search = '') => {
  const normalizedSearch = normalizeWhitespace(search) || ''

  return {
    search: normalizedSearch,
    words: normalizedSearch ? normalizedSearch.split(' ') : [],
    relation: 'AND',
  }
}

const buildJobFilters = (filters = {}) => ({
  categorys: Array.isArray(filters.categorys) ? filters.categorys : [],
  workExperiences: Array.isArray(filters.workExperiences) ? filters.workExperiences : [],
  locations: Array.isArray(filters.locations) ? filters.locations : [],
  programs: Array.isArray(filters.programs) ? filters.programs : [],
})

export const buildDetailUrl = (jobId) => {
  const normalizedId = String(jobId ?? '').trim().toUpperCase()
  if (!JOB_ID_PATTERN.test(normalizedId)) return null
  return `${DETAIL_PAGE_BASE_URL}${normalizedId}`
}

export const buildJobsApiUrl = ({
  page = 1,
  limit = JOBS_PAGE_SIZE,
  search = '',
  filters = {},
} = {}) => {
  const url = new URL(JOBS_API_URL)
  const input = {
    0: {
      json: {
        locales: API_LOCALE,
        page,
        jobQueryInfo: buildJobQueryInfo(search),
        filters: buildJobFilters(filters),
        sortBy: 'publishedDate',
        order: 'DESC',
        limit,
      },
    },
  }

  url.searchParams.set('batch', '1')
  url.searchParams.set('input', JSON.stringify(input))

  return url.toString()
}

export const hasVerifiedCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Openings\s*\|\s*MediaTek Careers\s*<\/title>/i.test(page)
    && page.includes('Search by role or keyword')
    && page.includes('/en/jobs')
    && page.includes('Noida')
    && page.includes('Bangalore')
}

export const extractJobsApiResult = (payload) => {
  if (Array.isArray(payload)) {
    return payload[0]?.result?.data?.json ?? null
  }

  return payload?.result?.data?.json ?? null
}

export const hasVerifiedJobsApiSignal = (payload) => {
  const result = extractJobsApiResult(payload)
  const jobs = Array.isArray(result?.jobs) ? result.jobs : []
  const pagination = result?.pagination

  return result?.status === 'complete'
    && jobs.length > 0
    && Number.isInteger(pagination?.current_page)
    && Number.isInteger(pagination?.total_pages)
    && Number.isInteger(pagination?.total_items)
    && jobs.every((job) =>
      JOB_ID_PATTERN.test(String(job?.id ?? ''))
      && normalizeWhitespace(job?.title)
      && normalizeCity(job?.properties?.location?.code),
    )
}

const isIndiaApiJob = (job = {}) => {
  const locationCode = normalizeWhitespace(job?.properties?.location?.label)
  const city = normalizeCity(job?.properties?.location?.code)
  const cityKey = city?.toLowerCase()

  return INDIA_LOCATION_CODE_SET.has(locationCode)
    || INDIA_CITY_SET.has(cityKey)
}

const extractMinimumQualification = (job = {}) => {
  const qualifications = (Array.isArray(job?.properties?.jobEducationInfos)
    ? job.properties.jobEducationInfos
    : [])
    .map((item) => {
      const degree = normalizeWhitespace(item?.educationDegree)
      const major = normalizeWhitespace(item?.educationMajor)
      return [degree, major].filter(Boolean).join(' - ')
    })
    .filter(Boolean)

  if (qualifications.length === 0) return null
  return [...new Set(qualifications)].join(' | ')
}

export const normalizeApiJob = (job = {}) => {
  if (!isIndiaApiJob(job)) return null

  const jobId = String(job.id ?? '').trim().toUpperCase()
  const title = normalizeWhitespace(job.title)
  const city = normalizeCity(job?.properties?.location?.code)
  if (!JOB_ID_PATTERN.test(jobId) || !title || !city) return null

  const department = normalizeWhitespace(job?.properties?.category?.label)
  const experienceRequired = normalizeWhitespace(job?.properties?.workExperience?.code)
  const minimumQualification = extractMinimumQualification(job)
  const description = normalizeMultilineText(job.description)
  const detailUrl = buildDetailUrl(jobId)

  return {
    title,
    company: COMPANY,
    department,
    location: `${city}, India`,
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job.publishedDate),
    closingDate: null,
    jobDescription: [
      department ? `Category: ${department}` : null,
      experienceRequired ? `Experience: ${experienceRequired}` : null,
      minimumQualification ? `Education: ${minimumQualification}` : null,
      description,
    ].filter(Boolean).join('\n\n'),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Cookie: LOCALE_COOKIE,
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Cookie: LOCALE_COOKIE,
  },
  label: `${SOURCE}-json`,
  timeoutMs: 20000,
})

export const createMediatekScraper = ({
  now = () => new Date().toISOString(),
  pageSize = JOBS_PAGE_SIZE,
  verifyCareersPage = false,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    // The public `/en/jobs` shell currently self-redirects under Node fetch even
    // though the first-party tRPC jobs API remains live and stable.
    if (verifyCareersPage) {
      const careersHtml = await fetchText(CAREERS_PAGE_URL)
      if (!hasVerifiedCareersPageSignal(careersHtml)) {
        throw new Error('The verified MediaTek careers page no longer matches the expected public openings shell')
      }
    }

    const scrapedAt = String(now())
    const jobs = []
    const seenIds = new Set()
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const payload = await fetchJson(buildJobsApiUrl({ page, limit: pageSize }))
      if (!hasVerifiedJobsApiSignal(payload)) {
        throw new Error('The verified MediaTek jobs API no longer matches the expected first-party public jobs contract')
      }

      const result = extractJobsApiResult(payload)
      totalPages = result.pagination.total_pages

      for (const apiJob of result.jobs) {
        const normalized = normalizeApiJob(apiJob)
        if (!normalized || seenIds.has(normalized.jobId)) continue

        seenIds.add(normalized.jobId)
        jobs.push({
          ...normalized,
          source: SOURCE,
          link: normalized.applyUrl,
          scrapedAt,
        })
      }

      page += 1
    }

    return jobs
  },
})

export const run = async (options = {}) => createMediatekScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total MediaTek India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
