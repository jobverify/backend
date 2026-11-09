import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { shouldContinueWorkdayJobsApiPagination } from '../../scraper-support/myworkday/engine.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import NEWFOLD_DIGITAL_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NEWFOLD_DIGITAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_INDIA_LOCATION_NAMES = PROVIDER_METADATA.verifiedIndiaLocationNames
export const WORKDAY_BOARD_ACCEPTED_URLS = [
  WORKDAY_BOARD_URL,
  'https://web.wd1.myworkdayjobs.com/en-US/ExternalCareerSite',
]

const PAGE_SIZE = 20
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
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

const isAcceptedWorkdayBoardUrl = (value) =>
  WORKDAY_BOARD_ACCEPTED_URLS.some((candidate) => sameUrl(value, candidate))

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

const extractJobId = (posting = {}) => {
  const requisitionId = Array.isArray(posting?.bulletFields)
    ? posting.bulletFields.find((value) => /^R\d+(?:-\d+)?$/i.test(String(value)))
    : null

  if (requisitionId) return requisitionId

  return String(posting?.externalPath ?? '').match(/_(R\d+(?:-\d+)?)(?:\/)?$/i)?.[1] || null
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

const isIndiaLocationDescriptor = (value) => /\bindia\b/i.test(normalizeWhitespace(value) || '')

const normalizeIndiaLocation = (value) => {
  const raw = normalizeWhitespace(value)
  if (!raw) return null

  if (/^india\s*-\s*remote$/i.test(raw)) {
    return 'Remote, India'
  }

  const cityCountryMatch = raw.match(/^(.+?),\s*India$/i)
  if (cityCountryMatch?.[1]) {
    return `${normalizeCity(cityCountryMatch[1])}, India`
  }

  if (/remote/i.test(raw) && /\bindia\b/i.test(raw)) {
    return 'Remote, India'
  }

  return raw
}

const extractCityFromLocation = (value) => {
  const normalized = normalizeIndiaLocation(value)
  if (!normalized) return null
  if (/^Remote,\s*India$/i.test(normalized)) return 'Remote'
  return normalizeCity(normalized.split(',')[0]?.trim() || normalized)
}

const extractLocationsFacetValues = (payload = {}) => {
  const locationsFacet = (Array.isArray(payload?.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === 'locationMainGroup')
    ?.values?.find((facet) => facet?.facetParameter === 'locations')

  if (!locationsFacet || !Array.isArray(locationsFacet.values)) {
    throw new Error('NewFold Digital verified India Workday facet changed materially')
  }

  return locationsFacet.values
}

const normalizePosting = (posting, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const summaryLocation = normalizeWhitespace(posting?.locationsText)
  const link = buildDetailUrl(posting?.externalPath)
  const jobId = extractJobId(posting)
  const location = normalizeIndiaLocation(summaryLocation)

  if (!title || !summaryLocation || !link || !jobId || !location) {
    throw new Error('NewFold Digital verified India Workday jobs payload changed materially')
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
    postedAt: normalizeWhitespace(posting?.postedOn),
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

  return /<title>\s*Careers\s*\|\s*NewFold Digital\s*<\/title>/i.test(page)
    && /Be a part of the fold/i.test(page)
    && /Browse Openings/i.test(page)
    && /newfold/i.test(page)
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
  const hasLegacyOpenJobsSignal =
    /property=["']og:title["'][^>]*content=["']Open Jobs["']/i.test(page)
    && /(Open Jobs|Search for Jobs)/i.test(page)
  const hasLiveWorkdayShell =
    /Newfold Digital is a leading web technology company/i.test(page)
    && /tenant:\s*"web"/i.test(page)
    && /siteId:\s*"ExternalCareerSite"/i.test(page)
    && /cx-jobs\.min\.js/i.test(page)

  return /rel=["']canonical["'][^>]*href=["']https:\/\/web\.wd1\.myworkdayjobs\.com\/(?:en-US\/)?ExternalCareerSite["']/i.test(page)
    && /property=["']og:title["'][^>]*>/i.test(page)
    && (hasLegacyOpenJobsSignal || hasLiveWorkdayShell)
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

export const createNewFoldDigitalScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxPages = Number.POSITIVE_INFINITY,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoardPage, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (
      workdayBoardPage.status !== 200
      || !isAcceptedWorkdayBoardUrl(workdayBoardPage.url)
      || !hasOfficialWorkdayBoardSignal(workdayBoardPage.html)
    ) {
      throw new Error('NewFold Digital verified public Workday board changed materially')
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

    return jobs.sort(
      (left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId),
    )
  },
})

export const run = async (options = {}) => createNewFoldDigitalScraper(options).run(options)

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
