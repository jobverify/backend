import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { hasWorkdayOutageSignal, shouldContinueWorkdayJobsApiPagination, WorkdayUpstreamOutageError } from '../../scraper-support/myworkday/engine.js'
import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { ARCTIC_WOLF_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = ARCTIC_WOLF_INDIA_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_INDIA_LOCATION_DESCRIPTORS =
  PROVIDER_METADATA.verifiedIndiaLocationDescriptors
export const VERIFIED_INDIA_JOB_URL = PROVIDER_METADATA.verifiedIndiaJobUrl
export const VERIFIED_INDIA_APPLY_URL = PROVIDER_METADATA.verifiedIndiaApplyUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const WORKDAY_BOARD_ACCEPTED_URLS = [
  WORKDAY_BOARD_URL,
  'https://arcticwolf.wd1.myworkdayjobs.com/en-US/External',
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

const mapWithConcurrency = async (items, limit, iteratee) => {
  const concurrency = Math.max(1, Number.isInteger(limit) ? limit : 1)
  const results = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
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

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Arctic Wolf - The Security Operations Leaders\s*<\/title>/i.test(page)
    && /Run With The Pack/i.test(page)
    && /View All Open Positions/i.test(page)
    && /arcticwolf\.wd1\.myworkdayjobs\.com\/External/i.test(page)
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

  return Number(page.status) === 200
    && isAcceptedWorkdayBoardUrl(finalUrl)
    && /property=["']og:title["'][^>]*content=["']Careers["']/i.test(html)
    && /At Arctic Wolf, we recognize that success comes from delighting our customers/i.test(html)
}

export const isArcticWolfIndiaLocationDescriptor = (value) => {
  const normalized = normalizeWhitespace(value) || ''

  return VERIFIED_INDIA_LOCATION_DESCRIPTORS.some((descriptor) => normalized === descriptor)
    || /,\s*IND$/i.test(normalized)
    || /(?:^|[\s-])IND(?:[\s-]|$)/i.test(normalized) && /Remote/i.test(normalized)
}

const extractLocationFacetValues = (payload = {}) => {
  const locationFacet = (Array.isArray(payload?.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === 'locationMainGroup')

  const nestedLocationsFacet = (Array.isArray(locationFacet?.values) ? locationFacet.values : [])
    .find((facet) => facet?.facetParameter === 'locations')

  if (!nestedLocationsFacet || !Array.isArray(nestedLocationsFacet.values)) {
    throw new Error('Arctic Wolf India verified India Workday facet changed materially')
  }

  return nestedLocationsFacet.values
}

export const extractIndiaLocationFacetIds = (payload = {}) =>
  extractLocationFacetValues(payload)
    .filter((value) => isArcticWolfIndiaLocationDescriptor(value?.descriptor))
    .map((value) => normalizeWhitespace(value?.id))
    .filter(Boolean)

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

const extractJobId = (posting = {}) => {
  const bulletFieldJobId = (Array.isArray(posting?.bulletFields) ? posting.bulletFields : [])
    .find((value) => /^R\d+_\d+(?:-\d+)?$/i.test(String(value)))

  if (bulletFieldJobId) return bulletFieldJobId

  return String(posting?.externalPath ?? '').match(/_(R\d+_\d+)(?:-\d+)?$/i)?.[1] || null
}

const buildDetailUrl = (externalPath) => {
  const normalized = String(externalPath ?? '')
  if (!normalized) return null
  if (/^https?:\/\//i.test(normalized)) return normalized.split('?')[0]
  if (!normalized.startsWith('/')) return null
  return `${WORKDAY_BOARD_URL}${normalized}`.split('?')[0]
}

const buildApplyUrl = (externalPath) => {
  const detailUrl = buildDetailUrl(externalPath)
  return detailUrl ? `${detailUrl}/apply` : null
}

const parseIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return {
    location: null,
    city: null,
    state: null,
    country: COUNTRY_FILTER,
  }

  const remoteMatch = normalized.match(/^Remote\s*-\s*IND\s*-\s*(.+)$/i)
  if (remoteMatch?.[1]) {
    const state = normalizeWhitespace(remoteMatch[1])
    return {
      location: state ? `Remote, ${state}, ${COUNTRY_FILTER}` : `Remote, ${COUNTRY_FILTER}`,
      city: null,
      state: state || null,
      country: COUNTRY_FILTER,
    }
  }

  const cityMatch = normalized.match(/^(.+?),\s*IND$/i)
  if (cityMatch?.[1]) {
    const city = normalizeWhitespace(cityMatch[1])
    return {
      location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
      city: city || null,
      state: null,
      country: COUNTRY_FILTER,
    }
  }

  return {
    location: normalized,
    city: null,
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
    throw new Error('Arctic Wolf India verified Workday jobs payload changed materially')
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

export const extractJobsFromPayload = (payload = {}, scrapedAt) =>
  (Array.isArray(payload?.jobPostings) ? payload.jobPostings : [])
    .filter((posting) => isArcticWolfIndiaLocationDescriptor(posting?.locationsText))
    .map((posting) => normalizePosting(posting, scrapedAt))

export const createArcticWolfIndiaScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200) {
      throw new Error(`HTTP ${careersPage.status} for ${CAREERS_URL}`)
    }
    if (
      !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Arctic Wolf India verified official careers surface changed materially')
    }

    const verifiedBoardUrl = extractVerifiedWorkdayBoardUrl(careersPage.html)
    if (!sameUrl(verifiedBoardUrl, WORKDAY_BOARD_URL)) {
      throw new Error('Arctic Wolf India verified Workday handoff changed materially')
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    if (hasWorkdayOutageSignal(workdayBoardPage)) {
      throw new WorkdayUpstreamOutageError(
        `[${SOURCE}] Workday is currently unavailable upstream at ${WORKDAY_BOARD_URL}`,
      )
    }
    if (workdayBoardPage.status !== 200) {
      throw new Error(`HTTP ${workdayBoardPage.status} for ${WORKDAY_BOARD_URL}`)
    }
    if (!hasOfficialWorkdayBoardSignal(workdayBoardPage)) {
      throw new Error('Arctic Wolf India verified public Workday board changed materially')
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

      for (const job of extractJobsFromPayload(payload, scrapedAt)) {
        if (seenJobIds.has(job.jobId)) continue

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

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const enrichedJobs = await mapWithConcurrency(
      selectedJobs,
      6,
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
            requisitionId: detail.requisitionId || job.requisitionId,
            postingDate: detail.postingDate || job.postingDate,
            jobDescription: detail.jobDescription || job.jobDescription,
            minimumQualification: detail.minimumQualification || job.minimumQualification,
            preferredQualification: detail.preferredQualification || job.preferredQualification,
            requiredSkills: Array.isArray(detail.requiredSkills) && detail.requiredSkills.length > 0
              ? detail.requiredSkills
              : job.requiredSkills,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
          }
        } catch {
          return job
        }
      },
    )

    return enrichedJobs
  },
})

export const run = async (options = {}) => createArcticWolfIndiaScraper(options).run(options)

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
