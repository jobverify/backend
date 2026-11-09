import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasWorkdayOutageSignal, WorkdayUpstreamOutageError } from '../../scraper-support/myworkday/engine.js'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { shouldContinueWorkdayJobsApiPagination } from '../../scraper-support/myworkday/engine.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { EINFOCHIPS_CATALOG } from './catalog.js'
import {runNativeEInfochips} from './nativeRun.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EINFOCHIPS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ARROW_SEARCH_URL = PROVIDER_METADATA.officialArrowSearchUrl
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_KEYWORD = PROVIDER_METADATA.verifiedKeyword
export const VERIFIED_INDIA_COUNTRY_FACET_DESCRIPTOR =
  PROVIDER_METADATA.verifiedIndiaCountryFacetDescriptor
export const VERIFIED_INDIA_COUNTRY_FACET_ID =
  PROVIDER_METADATA.verifiedIndiaCountryFacetId
export const VERIFIED_INDIA_JOB_URL = PROVIDER_METADATA.verifiedIndiaJobUrl
export const VERIFIED_INDIA_APPLY_URL = PROVIDER_METADATA.verifiedIndiaApplyUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const PAGE_SIZE = 20
const DETAIL_FETCH_CONCURRENCY = 4
const INDIA_COUNTRY_FACET_PARAMETER = 'Location_Country'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const WORKDAY_BOARD_ACCEPTED_URLS = [
  WORKDAY_BOARD_URL,
  'https://arrow.wd1.myworkdayjobs.com/AC/',
  'https://arrow.wd1.myworkdayjobs.com/en-US/AC',
  'https://arrow.wd1.myworkdayjobs.com/en-US/AC/',
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

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(20000),
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

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Join Us Today! - Career Opportunities and positions at eInfochips\s*<\/title>/i.test(page)
    && /Current Openings/i.test(page)
    && /Reshape the future of your career with us!/i.test(page)
    && /Presence in 140 countries with Arrow Electronics/i.test(page)
    && /Apply Now/i.test(page)
    && /https:\/\/careers\.arrow\.com\/us\/en\/search-results\?keywords=einfochips/i.test(page)
}

export const extractArrowSearchUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (sameUrl(match[1], ARROW_SEARCH_URL)) {
      return ARROW_SEARCH_URL
    }
  }

  return null
}

export const hasArrowSearchResultsSignal = (page = {}) => {
  const html = String(page.html ?? '')
  const finalUrl = getFinalUrl(page, ARROW_SEARCH_URL)

  return Number(page.status) === 200
    && sameUrl(finalUrl, ARROW_SEARCH_URL)
    && /Search results \| Find the available job openings at Arrow Electronics/i.test(html)
    && /phApp\.ddo\s*=/.test(html)
    && /"keywords":"einfochips"/i.test(html)
    && /arrow\.wd1\.myworkdayjobs\.com\/en-US\/AC\/?/i.test(html)
}

export const extractVerifiedWorkdayBoardUrlFromSearchPage = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (isAcceptedWorkdayBoardUrl(match[1])) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (page = {}) => {
  const html = String(page.html ?? '')
  const finalUrl = getFinalUrl(page, WORKDAY_BOARD_URL)

  return Number(page.status) === 200
    && isAcceptedWorkdayBoardUrl(finalUrl)
    && /rel=["']canonical["'][^>]*href=["']https:\/\/arrow\.wd1\.myworkdayjobs\.com\/AC["']/i.test(html)
    && /window\.workday\s*=\s*window\.workday/i.test(html)
    && /tenant:\s*"arrow"/i.test(html)
    && /siteId:\s*"AC"/i.test(html)
    && /appName:\s*"cxs"/i.test(html)
}

export const extractIndiaCountryFacetId = (payload = {}) => {
  const countryFacet = (Array.isArray(payload?.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === INDIA_COUNTRY_FACET_PARAMETER)

  const indiaFacetValue = (Array.isArray(countryFacet?.values) ? countryFacet.values : [])
    .find((value) => normalizeWhitespace(value?.descriptor) === VERIFIED_INDIA_COUNTRY_FACET_DESCRIPTOR)

  return normalizeWhitespace(indiaFacetValue?.id)
}

export const buildKeywordSearchRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText: VERIFIED_KEYWORD,
})

export const buildIndiaJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
  countryFacetId,
} = {}) => JSON.stringify({
  appliedFacets: {
    [INDIA_COUNTRY_FACET_PARAMETER]: [countryFacetId],
  },
  limit,
  offset,
  searchText: VERIFIED_KEYWORD,
})

const extractJobId = (posting = {}) => {
  const bulletFieldJobId = (Array.isArray(posting?.bulletFields) ? posting.bulletFields : [])
    .find((value) => /^R\d+(?:-\d+)?$/i.test(String(value)))

  if (bulletFieldJobId) return bulletFieldJobId

  return String(posting?.externalPath ?? '').match(/_(R\d+(?:-\d+)?)(?:\/)?$/i)?.[1] || null
}

const extractPrimaryLocationSegment = (externalPath) =>
  String(externalPath ?? '').match(/\/job\/([^/]+)\//i)?.[1] ?? null

const extractPrimaryCity = (externalPath) => {
  const segment = normalizeWhitespace(
    decodeURIComponent(extractPrimaryLocationSegment(externalPath) ?? '').replace(/\+/g, ' '),
  )

  if (!segment || /^Remote(?:-|$)/i.test(segment)) {
    return null
  }

  const withoutIndiaSuffix = segment.replace(/-India$/i, '')
  const firstToken = withoutIndiaSuffix.split('-')[0]
  return normalizeCity(firstToken) || null
}

const normalizeIndiaLocation = (posting = {}) => {
  const summaryLocation = normalizeWhitespace(posting?.locationsText)
  const primaryCity = extractPrimaryCity(posting?.externalPath)

  if (summaryLocation && /^\d+\s+Locations?$/i.test(summaryLocation)) {
    return {
      location: primaryCity ? `${primaryCity}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
      city: primaryCity,
      state: null,
      country: COUNTRY_FILTER,
    }
  }

  if (summaryLocation) {
    const directIndiaMatch = summaryLocation.match(/^(.+?),\s*India$/i)
    if (directIndiaMatch?.[1]) {
      const city = normalizeCity(directIndiaMatch[1]) || primaryCity
      return {
        location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
        city,
        state: null,
        country: COUNTRY_FILTER,
      }
    }

    const indiaOfficeMatch = summaryLocation.match(/^(.+?),\s*.+$/)
    if (indiaOfficeMatch?.[1] && !/Locations?/i.test(summaryLocation)) {
      const city = normalizeCity(indiaOfficeMatch[1]) || primaryCity
      return {
        location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
        city,
        state: null,
        country: COUNTRY_FILTER,
      }
    }
  }

  return {
    location: primaryCity ? `${primaryCity}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
    city: primaryCity,
    state: null,
    country: COUNTRY_FILTER,
  }
}

const buildDetailUrl = (externalPath) => {
  const normalized = String(externalPath ?? '')
  if (!normalized) return null

  try {
    if (/^https?:\/\//i.test(normalized)) {
      return normalized.split('?')[0]
    }

    if (normalized.startsWith('/')) {
      return `${WORKDAY_BOARD_URL}${normalized}`.split('?')[0]
    }

    return new URL(normalized, `${WORKDAY_BOARD_URL}/`).toString().split('?')[0]
  } catch {
    return null
  }
}

const buildApplyUrl = (externalPath) => {
  const detailUrl = buildDetailUrl(externalPath)
  return detailUrl ? `${detailUrl}/apply` : null
}

const normalizePosting = (posting = {}, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const jobId = extractJobId(posting)
  const sourceUrl = buildDetailUrl(posting?.externalPath)
  const applyUrl = buildApplyUrl(posting?.externalPath)
  const locationBits = normalizeIndiaLocation(posting)

  if (
    !title
    || !jobId
    || !sourceUrl
    || !applyUrl
    || !locationBits.location
  ) {
    throw new Error('eInfochips verified India Workday jobs payload changed materially')
  }

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

export const extractJobsFromPayload = (payload = {}, scrapedAt) =>
  (Array.isArray(payload?.jobPostings) ? payload.jobPostings : [])
    .map((posting) => normalizePosting(posting, scrapedAt))

export const createEInfochipsScraper = ({
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
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('eInfochips verified official careers surface changed materially')
    }

    const arrowSearchUrl = extractArrowSearchUrl(careersPage.html)
    if (!sameUrl(arrowSearchUrl, ARROW_SEARCH_URL)) {
      throw new Error('eInfochips verified careers handoff changed materially')
    }

    const arrowSearchPage = await fetchPage(ARROW_SEARCH_URL)
    if (!hasArrowSearchResultsSignal(arrowSearchPage)) {
      throw new Error('eInfochips verified Arrow search surface changed materially')
    }

    const verifiedWorkdayBoardUrl =
      extractVerifiedWorkdayBoardUrlFromSearchPage(arrowSearchPage.html)
    if (!sameUrl(verifiedWorkdayBoardUrl, WORKDAY_BOARD_URL)) {
      throw new Error('eInfochips verified Workday board handoff changed materially')
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    if (hasWorkdayOutageSignal(workdayBoardPage)) {
      throw new WorkdayUpstreamOutageError(`[${SOURCE}] Workday is currently unavailable upstream at ${WORKDAY_BOARD_URL}`)
    }
    if (workdayBoardPage.status !== 200) {
      throw new Error(`HTTP ${workdayBoardPage.status} for ${WORKDAY_BOARD_URL}`)
    }
    if (!hasOfficialWorkdayBoardSignal(workdayBoardPage)) {
      throw new Error('eInfochips verified public Workday board changed materially')
    }

    const unfilteredPayload = await fetchJson(
      JOBS_API_URL,
      buildKeywordSearchRequestBody({ offset: 0 }),
    )
    const indiaCountryFacetId = extractIndiaCountryFacetId(unfilteredPayload)

    if (indiaCountryFacetId !== VERIFIED_INDIA_COUNTRY_FACET_ID) {
      throw new Error('eInfochips verified India country facet changed materially')
    }

    const scrapedAt = now()
    const jobs = []
    const seenJobIds = new Set()
    let offset = 0
    let reachedMaxJobs = false

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(
        JOBS_API_URL,
        buildIndiaJobsRequestBody({
          offset,
          countryFacetId: indiaCountryFacetId,
        }),
      )
      const postings = Array.isArray(payload?.jobPostings) ? payload.jobPostings : []

      if (page === 1 && postings.length === 0) {
        return attachInventoryEvidence([], {status:'discovery-only',surface:ARROW_SEARCH_URL,firstParty:true,listingComplete:false,reason:'legacy-html-path-without-current-native-inventory-proof'})
      }

      for (const job of extractJobsFromPayload(payload, scrapedAt)) {
        if (seenJobIds.has(job.jobId)) continue

        seenJobIds.add(job.jobId)
        jobs.push(job)

        if (maxJobs && jobs.length >= maxJobs) {
          reachedMaxJobs = true
          break
        }
      }

      offset += postings.length
      if (reachedMaxJobs) {
        break
      }

      if (!shouldContinueWorkdayJobsApiPagination({
        jobsCount: postings.length,
        offsetAfterPage: offset,
        payloadTotal: payload?.total || 0,
        pageSize: PAGE_SIZE,
      })) {
        break
      }
    }

    const jobsToEnrich = maxJobs ? jobs.slice(0, maxJobs) : jobs

    const legacyJobs = await mapWithConcurrency(
      jobsToEnrich,
      DETAIL_FETCH_CONCURRENCY,
      async (job) => {
        try {
          const detailPage = await fetchPage(job.sourceUrl)
          if (Number(detailPage?.status) !== 200 || !detailPage?.html) {
            return job
          }

          const detail = await extractJobDetail({
            provider: 'workday',
            html: detailPage.html,
          })

          return {
            ...job,
            department: detail.department || job.department,
            jobDescription: detail.jobDescription || job.jobDescription,
            minimumQualification: detail.minimumQualification || job.minimumQualification,
            preferredQualification: detail.preferredQualification || job.preferredQualification,
            requiredSkills: Array.isArray(detail.requiredSkills) && detail.requiredSkills.length > 0
              ? detail.requiredSkills
              : job.requiredSkills,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
            requisitionId: detail.requisitionId || job.requisitionId,
            postingDate: detail.postingDate || job.postingDate,
          }
        } catch {
          return job
        }
      },
    )
    return attachInventoryEvidence(legacyJobs.map(job=>({...job,sourceListingComplete:false})), {status:'discovery-only',surface:ARROW_SEARCH_URL,firstParty:true,listingComplete:false,reason:'legacy-html-path-without-current-native-inventory-proof'})
  },
})

export const run = runNativeEInfochips

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
