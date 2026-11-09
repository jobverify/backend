import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import PROPERTY_GURU_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PAGE_SIZE = 20

export const PROVIDER_METADATA = PROPERTY_GURU_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_INDIA_LOCATION_DESCRIPTORS =
  PROVIDER_METADATA.verifiedIndiaLocationDescriptors
export const VERIFIED_INDIA_LOCATION_FACET_IDS =
  PROVIDER_METADATA.verifiedIndiaLocationFacetIds

const WORKDAY_BOARD_ACCEPTED_URLS = [WORKDAY_BOARD_URL]
const WORKDAY_BOARD_ACCEPTED_CANONICAL_URLS = [
  WORKDAY_BOARD_URL,
  'https://propertyguru.wd105.myworkdayjobs.com/PropertyGuru',
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractMetaContent = (html = '', name = '') => {
  const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const page = String(html ?? '')
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escapedName}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+property=["']${escapedName}["'][^>]*>`,
      'i',
    ),
  ]

  for (const pattern of patterns) {
    const match = page.match(pattern)
    if (match?.[1]) {
      return normalizeWhitespace(match[1])
    }
  }

  return null
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/\b(\d+)\s*[-â€“]\s*(\d+)\s*years?\b/i)
  if (rangeMatch) return `${rangeMatch[1]} - ${rangeMatch[2]} years`

  const plusMatch = normalized.match(/\b(\d+)\+\s*years?\b/i)
  if (plusMatch) return `${plusMatch[1]}+ years`

  const exactMatch = normalized.match(/\b(\d+)\s*years?\b/i)
  if (exactMatch) return `${exactMatch[1]} years`

  return null
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

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'content-type': 'application/json',
  },
  body,
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
})

const isAcceptedWorkdayBoardUrl = (value) =>
  WORKDAY_BOARD_ACCEPTED_URLS.some((candidate) => sameUrl(value, candidate))

const isAcceptedWorkdayBoardCanonicalUrl = (value) =>
  WORKDAY_BOARD_ACCEPTED_CANONICAL_URLS.some((candidate) => sameUrl(value, candidate))

const extractCanonicalUrl = (html = '') =>
  String(html ?? '').match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] || null

const shouldContinueJobsPagination = ({
  jobsCount = 0,
  total = 0,
  offsetAfterPage = 0,
  pageSize = PAGE_SIZE,
} = {}) => jobsCount >= pageSize && offsetAfterPage < total

const extractLocationFacetValues = (payload = {}) => {
  const locationFacet = (Array.isArray(payload?.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === 'locationMainGroup')
  const nestedLocationsFacet = (Array.isArray(locationFacet?.values) ? locationFacet.values : [])
    .find((facet) => facet?.facetParameter === 'locations')

  if (!nestedLocationsFacet || !Array.isArray(nestedLocationsFacet.values)) {
    throw new Error('PropertyGuru verified India location facet changed materially')
  }

  return nestedLocationsFacet.values
}

const extractJobId = (posting = {}) => {
  const bulletJobId = (Array.isArray(posting?.bulletFields) ? posting.bulletFields : [])
    .map((value) => normalizeWhitespace(value))
    .find((value) => /^JR\d+$/i.test(value || ''))

  if (bulletJobId) return bulletJobId

  return String(posting?.externalPath ?? '').match(/_(JR\d+)$/i)?.[1] || null
}

const buildDetailUrl = (externalPath) => {
  const normalized = String(externalPath ?? '')
  if (!normalized) return null
  if (/^https?:\/\//i.test(normalized)) return normalized.split('?')[0]
  if (!normalized.startsWith('/')) return null
  return `${WORKDAY_BOARD_URL.replace(/\/$/, '')}${normalized}`.split('?')[0]
}

const buildApplyUrl = (externalPath) => {
  const detailUrl = buildDetailUrl(externalPath)
  return detailUrl ? `${detailUrl}/apply` : null
}

const parseIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: COUNTRY_FILTER,
    }
  }

  if (/^india$/i.test(normalized)) {
    return {
      location: COUNTRY_FILTER,
      city: null,
      state: null,
      country: COUNTRY_FILTER,
    }
  }

  return {
    location: `${normalized}, ${COUNTRY_FILTER}`,
    city: normalized,
    state: null,
    country: COUNTRY_FILTER,
  }
}

const normalizePosting = (posting = {}, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const locationText = normalizeWhitespace(posting?.locationsText)
  const jobId = extractJobId(posting)
  const sourceUrl = buildDetailUrl(posting?.externalPath)
  const applyUrl = buildApplyUrl(posting?.externalPath)

  if (!title || !locationText || !jobId || !sourceUrl || !applyUrl) {
    throw new Error('PropertyGuru verified Workday jobs payload changed materially')
  }

  const locationBits = parseIndiaLocation(locationText)

  return {
    jobId,
    title,
    company: COMPANY_NAME,
    department: null,
    location: locationBits.location,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    sourceUrl,
    applyUrl,
    employmentType: normalizeWhitespace(posting?.timeType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(posting?.postedOn),
    closingDate: null,
    jobDescription: null,
    requisitionId: jobId,
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /Careers-\s*Be More,Be a Guru\./i.test(page)
    && /We are hiring!/i.test(page)
    && /View open roles/i.test(page)
    && /Join Us/i.test(page)
    && /propertyguru\.wd105\.myworkdayjobs\.com\/en-US\/PropertyGuru\//i.test(page)
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isAcceptedWorkdayBoardUrl(match[1])) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (page = {}) => {
  const finalUrl = getFinalUrl(page, WORKDAY_BOARD_URL)
  const html = String(page.html ?? '')
  const canonicalUrl = extractCanonicalUrl(html)

  return Number(page.status) === 200
    && isAcceptedWorkdayBoardUrl(finalUrl)
    && isAcceptedWorkdayBoardCanonicalUrl(canonicalUrl || finalUrl)
    && /PropertyGuru/i.test(html)
}

export const hasOfficialJobDetailSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = stripHtml(html) || ''
  const metaTitle = extractMetaContent(html, 'og:title')
  const metaDescription = extractMetaContent(html, 'og:description')

  return Number(page?.status) === 200
    && (
      (
        /<title>\s*.+<\/title>/i.test(html)
        && /<h1[^>]*>.+<\/h1>/i.test(html)
        && text.includes('Requirements')
      )
      || (
        Boolean(metaTitle)
        && Boolean(metaDescription)
        && /PropertyGuru/i.test(metaDescription)
      )
    )
}

export const isPropertyGuruIndiaLocationDescriptor = (value) => {
  const normalized = normalizeWhitespace(value) || ''
  return VERIFIED_INDIA_LOCATION_DESCRIPTORS.some((descriptor) => normalized === descriptor)
}

export const extractIndiaLocationFacetIds = (payload = {}) => {
  const seen = new Set()
  const ids = []

  for (const value of extractLocationFacetValues(payload)) {
    if (!isPropertyGuruIndiaLocationDescriptor(value?.descriptor)) continue

    const id = normalizeWhitespace(value?.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }

  return ids
}

export const buildUnfilteredJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: '',
})

export const buildIndiaJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
  locationFacetIds = [],
} = {}) => JSON.stringify({
  appliedFacets: {
    locations: locationFacetIds,
  },
  limit,
  offset,
  searchText: '',
})

export const extractJobsFromPayload = (payload = {}, scrapedAt) => {
  const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : null
  if (!postings) {
    throw new Error('PropertyGuru verified Workday jobs payload changed materially')
  }

  return postings
    .filter((posting) => isPropertyGuruIndiaLocationDescriptor(posting?.locationsText))
    .map((posting) => normalizePosting(posting, scrapedAt))
}

export const extractExperienceFromJobDetailPage = (html = '') => {
  const text = extractMetaContent(html, 'og:description') || stripHtml(html) || ''
  const candidate = text.match(
    /\b(?:\d+\s*[-â€“]\s*\d+\s*years?|\d+\+\s*years?|\d+\s*years?)\b[^.]{0,140}\b(?:products?|experience)\b/i,
  )?.[0]

  return normalizeExperience(candidate)
}

export const extractJobDescriptionFromDetailPage = (html = '') =>
  extractMetaContent(html, 'og:description') || stripHtml(html) || null

export const enrichJobWithDetailPage = (job, page = {}) => ({
  ...job,
  jobDescription: extractJobDescriptionFromDetailPage(page.html) || job.jobDescription || null,
  experienceRequired: extractExperienceFromJobDetailPage(page.html) || job.experienceRequired,
  publicExperienceChecked: true,
})

export const enrichJobsWithDetailPages = async (jobs, fetchPage = defaultFetchPage) => Promise.all(
  jobs.map(async (job) => {
    try {
      const page = await fetchPage(job.sourceUrl)
      if (!hasOfficialJobDetailSignal(page)) return job
      return enrichJobWithDetailPage(job, page)
    } catch {
      return job
    }
  }),
)

export const createPropertyGuruScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (
      Number(careersPage?.status) !== 200
      || !sameUrl(careersPage?.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage?.html)
    ) {
      throw new Error('PropertyGuru verified official careers surface changed materially')
    }

    const verifiedBoardUrl = extractVerifiedWorkdayBoardUrl(careersPage.html)
    if (!sameUrl(verifiedBoardUrl, WORKDAY_BOARD_URL)) {
      throw new Error('PropertyGuru verified Workday handoff changed materially')
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoardPage, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (!hasOfficialWorkdayBoardSignal(workdayBoardPage)) {
      throw new Error('PropertyGuru verified public Workday board changed materially')
    }

    const unfilteredPayload = await fetchJson(
      JOBS_API_URL,
      buildUnfilteredJobsRequestBody({ offset: 0 }),
    )
    const locationFacetIds = extractIndiaLocationFacetIds(unfilteredPayload)

    if (
      locationFacetIds.length === 0
      || !VERIFIED_INDIA_LOCATION_FACET_IDS.every((id) => locationFacetIds.includes(id))
    ) {
      throw new Error('PropertyGuru verified India location facet changed materially')
    }

    const scrapedAt = now()
    const jobs = []
    const seenJobIds = new Set()
    let offset = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(
        JOBS_API_URL,
        buildIndiaJobsRequestBody({ offset, locationFacetIds }),
      )
      const pageJobs = extractJobsFromPayload(payload, scrapedAt)

      if (page === 1 && pageJobs.length === 0) {
        return []
      }

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      offset += pageJobs.length
      if (!shouldContinueJobsPagination({
        jobsCount: pageJobs.length,
        total: Number(payload?.total || 0),
        offsetAfterPage: offset,
      })) {
        break
      }
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    return enrichJobsWithDetailPages(selectedJobs, fetchPage)
  },
})

export const run = async (options = {}) => createPropertyGuruScraper(options).run(options)

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
