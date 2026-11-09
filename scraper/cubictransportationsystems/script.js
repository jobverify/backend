import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { CUBIC_TRANSPORTATION_SYSTEMS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const DETAIL_API_BASE_URL = JOBS_API_URL.replace(/\/jobs$/, '')
export const WORKDAY_DETAIL_BASE_URL = 'https://cubic.wd1.myworkdayjobs.com/en-US/cubic_global_careers'
export const VERIFIED_JOB_DETAIL_URLS = [
  'https://cubic.wd1.myworkdayjobs.com/en-US/cubic_global_careers/job/Hyderabad-Telangana/Senior-Site-Reliability-Engineer_REQ_48649',
  'https://cubic.wd1.myworkdayjobs.com/en-US/cubic_global_careers/job/IND-Hyderabad-Aparna/Head-of-Technology-and-Service-Operations_REQ_48615-2',
]
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const VERIFIED_BUSINESS_UNIT = 'Cubic Transportation Systems'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const WORKDAY_BOARD_CANONICAL_URL = 'https://cubic.wd1.myworkdayjobs.com/cubic_global_careers'
const PAGE_SIZE = 20
const DEFAULT_DETAIL_CONCURRENCY = 4
const INDIA_LOCATION_PATTERN = /\b(india|hyderabad|telangana|aparna)\b/i
const GROUPED_LOCATION_PATTERN = /^\d+\s+locations?$/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&#8211;|&#8212;|&#x2013;|&#x2014;|&ndash;|&mdash;/gi, '-')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractMetaContent = (html = '', propertyName = '') => normalizeWhitespace(
  String(html ?? '').match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegExp(propertyName)}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i'),
  )?.[1],
)

const extractPrimaryLocationSegment = (externalPath = '') =>
  String(externalPath ?? '').match(/\/job\/([^/]+)\//i)?.[1] ?? null

const normalizeLocationToken = (value) => normalizeWhitespace(value)
  .replace(/^IND[\s-]+/i, '')
  .replace(/\bAparna\b/gi, '')
  .replace(/\s{2,}/g, ' ')
  .trim()

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const limit = Math.max(1, Number.parseInt(concurrency, 10) || 1)
  const results = new Array(items.length)
  let nextIndex = 0
  let firstError = null

  const worker = async () => {
    while (!firstError) {
      const index = nextIndex
      nextIndex += 1

      if (index >= items.length) return

      try {
        results[index] = await mapper(items[index], index)
      } catch (error) {
        firstError ||= error
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )

  if (firstError) throw firstError
  return results
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'content-type': 'application/json',
  },
  body,
  label: `${SOURCE}-json`,
  timeoutMs: 20000,
})
const defaultFetchDetailJson = (url) => fetchJsonWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  label: `${SOURCE}-detail-json`,
  timeoutMs: 20000,
})

export const buildJobsRequestBody = ({
  limit = PAGE_SIZE,
  offset = 0,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: '',
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('Global Careers')
    && text.includes('We have jobs at all of our locations around the world. What do you want to do?')
    && text.includes('Global Career Opportunities')
    && new RegExp(`href=["']${escapeRegExp(WORKDAY_BOARD_URL)}["']`, 'i').test(page)
}

export const hasOfficialCareersBlockSignal = (html = '') => {
  const page = String(html ?? '')

  return /noindex,\s*nofollow/i.test(page)
    && /_Incapsula_Resource/i.test(page)
    && /Incapsula/i.test(page)
    && (
      /Request unsuccessful\.\s*Incapsula incident ID:/i.test(page)
      || (/<script\b[^>]*src=["']\/_Incapsula_Resource\?[^"']+["']/i.test(page)
        && /<body[^>]*>\s*<\/body>/i.test(page)
        && page.length < 1500)
    )
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${escapeRegExp(WORKDAY_BOARD_CANONICAL_URL)}["']`, 'i').test(page)
    && /Global\.Innovative\.Trusted/i.test(page)
    && new RegExp(`<meta\\s+property=["']og:url["']\\s+content=["']${escapeRegExp(WORKDAY_BOARD_URL)}["']`, 'i').test(page)
}

export const isBlockedWorkdayApiPayload = (payload = {}) =>
  String(payload?.errorCode ?? '').toUpperCase() === 'HTTP_500'
  && Number(payload?.httpStatus) === 500

export const extractStructuredJobPosting = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const payload = JSON.parse(match[1])
      if (payload?.['@type'] === 'JobPosting') {
        const description = normalizeWhitespace(payload?.description)
        const businessUnit = normalizeWhitespace(
          description.match(/Business Unit:\s*([\s\S]*?)(?=\s+Company Details:|\s+Job Details:|$)/i)?.[1],
        )

        return {
          title: normalizeWhitespace(payload?.title) || extractMetaContent(html, 'og:title'),
          description: description || extractMetaContent(html, 'og:description'),
          requisitionId: normalizeWhitespace(payload?.identifier?.value),
          employmentType: normalizeWhitespace(payload?.employmentType),
          postingDate: normalizeWhitespace(payload?.datePosted),
          country: normalizeWhitespace(payload?.jobLocation?.address?.addressCountry),
          locality: normalizeWhitespace(payload?.jobLocation?.address?.addressLocality),
          businessUnit,
          hiringOrganization: normalizeWhitespace(payload?.hiringOrganization?.name),
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks and continue scanning.
    }
  }

  return null
}

export const buildWorkdayDetailApiUrl = (externalPath) => {
  const path = String(externalPath ?? '').trim()
  if (!/^\/job\/[a-z0-9%._-]+\/[a-z0-9%._-]+$/i.test(path)) {
    throw new Error('Cubic Transportation Systems invalid Workday detail API path')
  }
  return `${DETAIL_API_BASE_URL}${path}`
}

export const extractWorkdayApiDetail = (payload, posting = {}) => {
  const info = payload?.jobPostingInfo
  const description = normalizeWhitespace(String(info?.jobDescription ?? '').replace(/<[^>]+>/g, ' '))
  const businessUnit = normalizeWhitespace(description.match(/Business Unit:\s*(.*?)\s*Company Details:/i)?.[1])
  const requisitionId = normalizeWhitespace(info?.jobReqId)
  const country = normalizeWhitespace(info?.country?.descriptor)
  const externalPath = String(posting.externalPath ?? '')
  if (!info || !normalizeWhitespace(info.title) || !description || !businessUnit || !requisitionId || !country
    || !String(info.externalUrl ?? '').endsWith(externalPath)
    || (posting.bulletFields?.[0] && requisitionId !== posting.bulletFields[0])) {
    throw new Error('Cubic Transportation Systems Workday detail API contract changed materially')
  }
  return {
    title: normalizeWhitespace(info.title),
    description,
    requisitionId,
    employmentType: normalizeWhitespace(info.timeType),
    postingDate: normalizeWhitespace(info.startDate),
    country,
    locality: normalizeWhitespace(info.location),
    businessUnit,
    hiringOrganization: normalizeWhitespace(payload?.hiringOrganization?.name),
    canApply: info.canApply === true && info.posted === true,
  }
}

export const hasVerifiedCtsJobDetailSignal = (html = '') => {
  const detail = extractStructuredJobPosting(html)

  return detail?.title === 'Senior Site Reliability Engineer'
    && detail?.requisitionId === 'REQ_48649'
    && detail?.businessUnit === VERIFIED_BUSINESS_UNIT
    && detail?.country === COUNTRY_FILTER
    && /Hyderabad/i.test(detail?.locality || '')
}

export const isLikelyIndiaPosting = (posting = {}) => {
  const locationText = normalizeWhitespace(posting?.locationsText)

  if (GROUPED_LOCATION_PATTERN.test(locationText)) {
    return true
  }

  const pathLocation = normalizeWhitespace(
    decodeURIComponent(extractPrimaryLocationSegment(posting?.externalPath) ?? '').replace(/\+/g, ' '),
  )

  return INDIA_LOCATION_PATTERN.test(`${locationText} ${pathLocation}`)
}

export const buildDetailUrl = (externalPath = '') => {
  const normalized = String(externalPath ?? '').trim()
  if (!normalized) return null

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.split('?')[0]
  }

  if (normalized.startsWith('/')) {
    return `${WORKDAY_DETAIL_BASE_URL}${normalized}`.split('?')[0]
  }

  try {
    return new URL(normalized, `${WORKDAY_DETAIL_BASE_URL}/`).toString().split('?')[0]
  } catch {
    return null
  }
}

export const buildApplyUrl = (detailUrl) => {
  const normalized = normalizeWhitespace(detailUrl)
  return normalized ? `${normalized}/apply` : null
}

export const buildLocationBits = (detail = {}, posting = {}) => {
  const locality = normalizeWhitespace(detail?.locality)
    || normalizeWhitespace(posting?.locationsText)
    || normalizeWhitespace(
      decodeURIComponent(extractPrimaryLocationSegment(posting?.externalPath) ?? '').replace(/\+/g, ' '),
    )

  const normalizedLocality = normalizeLocationToken(locality)
  const parts = normalizedLocality
    ? normalizedLocality.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
    : []
  const rawCity = parts[0] || normalizedLocality
  const city = normalizeCity(rawCity) || rawCity || null
  const state = parts.length > 1 ? parts[1] : null

  return {
    location: [city, state, COUNTRY_FILTER].filter(Boolean).join(', ') || COUNTRY_FILTER,
    city,
    state,
    country: COUNTRY_FILTER,
  }
}

export const normalizePosting = ({
  posting = {},
  detail = {},
  detailUrl,
  applyUrl,
  scrapedAt,
}) => {
  const title = normalizeWhitespace(detail?.title || posting?.title)
  const jobId = normalizeWhitespace(detail?.requisitionId)
    || normalizeWhitespace((Array.isArray(posting?.bulletFields) ? posting.bulletFields : [])[0])
    || normalizeWhitespace(
      String(posting?.externalPath ?? '').match(/_(REQ_\d+)(?:-\d+)?(?:\/)?$/i)?.[1],
    )
  const locationBits = buildLocationBits(detail, posting)

  if (!title || !jobId || !detailUrl || !applyUrl || !locationBits.location) {
    throw new Error('Cubic Transportation Systems verified Workday payload changed materially')
  }

  return {
    jobId,
    title,
    company: COMPANY,
    department: normalizeWhitespace(detail?.businessUnit) || null,
    location: locationBits.location,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    sourceUrl: detailUrl,
    applyUrl,
    employmentType: normalizeWhitespace(detail?.employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(detail?.postingDate),
    closingDate: null,
    jobDescription: normalizeWhitespace(detail?.description),
    requisitionId: jobId,
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

export const createCubicTransportationSystemsScraper = ({
  pageSize = PAGE_SIZE,
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchDetailJson = defaultFetchDetailJson,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml) && !hasOfficialCareersBlockSignal(careersHtml)) {
      throw new Error('The verified Cubic careers page no longer matches the trusted first-party surface')
    }

    const boardHtml = await fetchText(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable({ status: 200, html: boardHtml, url: WORKDAY_BOARD_URL }, { source: SOURCE })
    if (!hasOfficialWorkdayBoardSignal(boardHtml)) {
      throw new Error('The verified Cubic Workday board no longer matches the trusted public surface')
    }

    const scrapedAt = now()
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1, offset = 0; page <= maxPages; page += 1) {
      const payload = await fetchJson(
        JOBS_API_URL,
        buildJobsRequestBody({ limit: pageSize, offset }),
      )
      const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : null

      if (!postings) {
        throw new Error('Cubic Transportation Systems Workday jobs API contract changed materially')
      }

      if (page === 1 && postings.length === 0) {
        return []
      }

      const candidatePostings = postings.filter(isLikelyIndiaPosting)
      const detailedJobs = await mapWithConcurrency(
        candidatePostings,
        detailConcurrency,
        async (posting) => {
          const detailUrl = buildDetailUrl(posting?.externalPath)
          const applyUrl = buildApplyUrl(detailUrl)

          if (!detailUrl || !applyUrl) {
            throw new Error('Cubic Transportation Systems verified Workday detail URL contract changed materially')
          }

          const detail = extractWorkdayApiDetail(
            await fetchDetailJson(buildWorkdayDetailApiUrl(posting.externalPath)),
            posting,
          )

          if (!detail?.title || !detail?.description || !detail?.country) {
            throw new Error('Cubic Transportation Systems verified job detail structured data changed materially')
          }

          if (!detail.canApply || detail.country !== COUNTRY_FILTER) {
            return null
          }

          if (detail.businessUnit !== VERIFIED_BUSINESS_UNIT) {
            return null
          }

          return normalizePosting({
            posting,
            detail,
            detailUrl,
            applyUrl,
            scrapedAt,
          })
        },
      )

      for (const job of detailedJobs.filter(Boolean)) {
        if (seenJobIds.has(job.jobId)) continue

        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs.slice(0, maxJobs)
      }

      offset += postings.length
      if (postings.length < pageSize) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createCubicTransportationSystemsScraper(options).run(options)

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
