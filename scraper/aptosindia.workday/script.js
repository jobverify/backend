import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { shouldContinueWorkdayJobsApiPagination } from '../../scraper-support/myworkday/engine.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import APTOS_INDIA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = APTOS_INDIA_CATALOG.source
export const COMPANY = APTOS_INDIA_CATALOG.companyName
export const CAREERS_URL = APTOS_INDIA_CATALOG.companyCareerPage
export const WORKDAY_BOARD_URL = APTOS_INDIA_CATALOG.officialWorkdayBoardUrl
export const JOBS_API_URL = APTOS_INDIA_CATALOG.jobsApiUrl
export const VERIFIED_AT = APTOS_INDIA_CATALOG.verifiedOn
export const VERIFIED_INDIA_LOCATION_NAME = APTOS_INDIA_CATALOG.verifiedIndiaLocationName
export const WORKDAY_BOARD_ACCEPTED_URLS = [
  WORKDAY_BOARD_URL,
  'https://aptos.wd108.myworkdayjobs.com/en-US/Aptos',
]

const PAGE_SIZE = 20
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
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

const isIndiaLocationDescriptor = (value) => /\b(india|bangalore|bengaluru)\b/i.test(
  normalizeWhitespace(value) || '',
)

const extractLocationsFacetValues = (payload = {}) => {
  const locationsFacet = (Array.isArray(payload?.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === 'locationMainGroup')
    ?.values?.find((facet) => facet?.facetParameter === 'locations')

  if (!locationsFacet || !Array.isArray(locationsFacet.values)) {
    throw new Error('Aptos India verified India Workday facet changed materially')
  }

  return locationsFacet.values
}

const extractJobId = (posting = {}) => {
  const requisitionId = Array.isArray(posting?.bulletFields)
    ? posting.bulletFields.find((value) => /^JR\d+(?:-\d+)?$/i.test(String(value)))
    : null

  if (requisitionId) return requisitionId

  return String(posting?.externalPath ?? '').match(/_(JR\d+(?:-\d+)?)(?:\/)?$/i)?.[1] || null
}

const buildDetailUrl = (externalPath) => {
  if (!externalPath) return null

  try {
    if (String(externalPath).startsWith('/')) {
      return `${WORKDAY_BOARD_URL}${externalPath}`.split('?')[0]
    }

    return new URL(String(externalPath), `${WORKDAY_BOARD_URL}/`).toString().split('?')[0]
  } catch {
    return null
  }
}

const normalizeIndiaLocation = (value) => {
  const raw = normalizeWhitespace(value)
  if (!raw) return null

  const officeMatch = raw.match(/^IN\s+(.+?)\s+Office$/i)
  if (officeMatch?.[1]) {
    return `${normalizeCity(officeMatch[1])}, India`
  }

  if (/\bbangalore\b|\bbengaluru\b/i.test(raw)) {
    return `${normalizeCity(raw)}, India`
  }

  if (/\bindia\b/i.test(raw)) {
    return raw
  }

  return raw
}

const extractCityFromLocation = (value) => {
  const normalized = normalizeIndiaLocation(value)
  if (!normalized) return null

  return normalizeCity(normalized.split(',')[0]?.trim() || normalized)
}

const normalizePosting = (posting, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const summaryLocation = normalizeWhitespace(posting?.locationsText)
  const link = buildDetailUrl(posting?.externalPath)
  const jobId = extractJobId(posting)
  const location = normalizeIndiaLocation(summaryLocation)

  if (!title || !summaryLocation || !link || !jobId || !location) {
    throw new Error('Aptos India verified India Workday jobs payload changed materially')
  }

  return {
    jobId,
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractCityFromLocation(summaryLocation),
    locations: [summaryLocation],
    link,
    source: SOURCE,
    postedAt: null,
    closingDate: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    experienceRequired: null,
    requisitionId: jobId,
    scrapedAt,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Aptos\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*<b>\s*Aptos Careers\s*<\/b>\s*<\/h1>/i.test(page)
    && /Careers Quick Links/i.test(page)
    && /brightest minds in retail technology/i.test(page)
    && />\s*(?:View Jobs|Search Open Jobs)\s*</i.test(page)
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isAcceptedWorkdayBoardUrl(match[1])) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /rel=["']canonical["'][^>]*href=["']https:\/\/aptos\.wd108\.myworkdayjobs\.com\/Aptos["']/i.test(page)
    && /property=["']og:title["'][^>]*content=["']Open Jobs["']/i.test(page)
    && /property=["']og:description["'][^>]*content=["'][^"']*Aptos is the global leader in unified commerce solutions for retailers/i.test(page)
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

export const extractIndiaLocationFacetIds = (payload = {}) =>
  extractLocationsFacetValues(payload)
    .filter((value) => isIndiaLocationDescriptor(value?.descriptor))
    .map((value) => normalizeWhitespace(value?.id))
    .filter(Boolean)

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

export const createAptosIndiaScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxPages = Number.POSITIVE_INFINITY,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Aptos India verified official careers surface changed materially')
    }

    const verifiedBoardUrl = extractVerifiedWorkdayBoardUrl(careersPage.html)
    if (!sameUrl(verifiedBoardUrl, WORKDAY_BOARD_URL)) {
      throw new Error('Aptos India verified Workday handoff changed materially')
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoardPage, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (
      workdayBoardPage.status !== 200
      || !isAcceptedWorkdayBoardUrl(workdayBoardPage.url)
      || !hasOfficialWorkdayBoardSignal(workdayBoardPage.html)
    ) {
      throw new Error('Aptos India verified public Workday board changed materially')
    }

    const unfilteredPayload = await fetchJson(
      JOBS_API_URL,
      buildUnfilteredJobsRequestBody({ offset: 0 }),
    )
    const locationFacetIds = extractIndiaLocationFacetIds(unfilteredPayload)

    if (locationFacetIds.length === 0) {
      return []
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
      const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []

      if (page === 1 && postings.length === 0) {
        return []
      }

      for (const posting of postings) {
        const summaryLocation = normalizeWhitespace(posting?.locationsText)
        if (!isIndiaLocationDescriptor(summaryLocation)) {
          continue
        }

        const job = normalizePosting(posting, scrapedAt)
        if (seenJobIds.has(job.jobId)) {
          continue
        }

        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      offset += postings.length
      if (!shouldContinueWorkdayJobsApiPagination({
        jobsCount: postings.length,
        offsetAfterPage: offset,
        payloadTotal: payload?.total || 0,
        pageSize: PAGE_SIZE,
      })) {
        break
      }
    }

    return jobs.sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createAptosIndiaScraper(options).run(options)

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
