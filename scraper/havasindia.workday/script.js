import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { shouldContinueWorkdayJobsApiPagination } from '../../scraper-support/myworkday/engine.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import HAVAS_INDIA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HAVAS_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_INDIA_COUNTRY_FACET_ID = PROVIDER_METADATA.verifiedIndiaCountryFacetId

const PAGE_SIZE = 20
const DETAIL_FETCH_CONCURRENCY = 4
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const WORKDAY_ORIGIN = new URL(WORKDAY_BOARD_URL).origin

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

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const limit = Math.max(1, Number.parseInt(concurrency, 10) || 1)
  const results = new Array(items.length)
  let nextIndex = 0
  let firstError = null

  const worker = async () => {
    while (!firstError) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) return
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex)
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

const extractJobId = (posting = {}) => {
  const requisitionId = Array.isArray(posting?.bulletFields)
    ? posting.bulletFields.find((value) => /^JR\d+(?:-\d+)?$/i.test(String(value)))
    : null

  if (requisitionId) return requisitionId

  return String(posting?.externalPath ?? '').match(/_(JR\d+(?:-\d+)?)(?:\/)?$/i)?.[1] || null
}

export const buildDetailUrl = (externalPath) => {
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

const extractPathLocation = (externalPath) => {
  const segment = String(externalPath ?? '').match(/^\/job\/([^/]+)\//)?.[1]
  if (!segment) return null

  return normalizeCity(segment.replace(/---/g, ' ').replace(/-/g, ' ')) || null
}

const extractCityFromLocation = (summaryLocation, externalPath) => {
  const normalized = normalizeWhitespace(summaryLocation)
  if (!normalized) {
    return extractPathLocation(externalPath)
  }

  if (/remote/i.test(normalized)) {
    return 'Remote'
  }

  if (/^\d+\s+locations?$/i.test(normalized) || /^multiple locations$/i.test(normalized)) {
    return extractPathLocation(externalPath)
  }

  return normalizeCity(normalized) || normalized
}

const normalizeIndiaLocation = (summaryLocation, externalPath) => {
  const city = extractCityFromLocation(summaryLocation, externalPath)
  return city ? `${city}, India` : null
}

const normalizePosting = (posting, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const summaryLocation = normalizeWhitespace(posting?.locationsText)
  const link = buildDetailUrl(posting?.externalPath)
  const jobId = extractJobId(posting)
  const city = extractCityFromLocation(summaryLocation, posting?.externalPath)
  const location = normalizeIndiaLocation(summaryLocation, posting?.externalPath)

  if (!title || !link || !jobId || !city || !location) {
    throw new Error('Havas India verified Workday jobs payload changed materially')
  }

  return {
    jobId,
    title,
    company: COMPANY,
    department: null,
    location,
    city,
    locations: summaryLocation ? [summaryLocation] : [],
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

  return /<title>\s*Careers - Havas India\s*<\/title>/i.test(page)
    && /rel=["']canonical["'][^>]*href=["']https:\/\/in\.havas\.com\/careers\/["']/i.test(page)
    && /People & Culture/i.test(page)
    && /Life At Havas/i.test(page)
    && /Explore our current job openings and take the next step in your career with Havas India\./i.test(page)
    && /https:\/\/rb\.gy\/5daebl/i.test(page)
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  const page = String(html ?? '')

  if (/https:\/\/rb\.gy\/5daebl/i.test(page)) {
    return WORKDAY_BOARD_URL
  }

  for (const match of page.matchAll(/href=["']([^"']+)["']/gi)) {
    if (sameUrl(match[1], WORKDAY_BOARD_URL)) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /property=["']og:url["'][^>]*content=["']https:\/\/wd3\.myworkdaysite\.com\/recruiting\/havas\/GroupExternalCareerSite["']/i.test(page)
    && /property=["']og:description["'][^>]*content=["'][\s\S]*?Founded in 1835 by Charles-Louis Havas/i.test(page)
    && /tenant:\s*"havas"/i.test(page)
    && /siteId:\s*"GroupExternalCareerSite"/i.test(page)
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

export const extractIndiaCountryFacetId = (payload = {}) => {
  const countryFacet = (Array.isArray(payload?.facets) ? payload.facets : [])
    .find((facet) => facet?.facetParameter === 'Country')

  if (!countryFacet || !Array.isArray(countryFacet.values)) {
    throw new Error('Havas India verified India country facet changed materially')
  }

  const indiaFacet = countryFacet.values.find((value) => normalizeWhitespace(value?.descriptor) === 'India')
  const facetId = normalizeWhitespace(indiaFacet?.id)

  if (!facetId || facetId !== VERIFIED_INDIA_COUNTRY_FACET_ID) {
    throw new Error('Havas India verified India country facet changed materially')
  }

  return facetId
}

export const buildIndiaJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
  countryFacetId = VERIFIED_INDIA_COUNTRY_FACET_ID,
} = {}) => JSON.stringify({
  appliedFacets: {
    Country: [countryFacetId],
  },
  limit,
  offset,
  searchText: '',
})

export const extractJobsFromPayload = (payload = {}, scrapedAt = new Date().toISOString()) => (
  Array.isArray(payload?.jobPostings)
    ? payload.jobPostings.map((posting) => normalizePosting(posting, scrapedAt))
    : []
)

const defaultFetchJobsPage = async ({
  offset = 0,
  limit = PAGE_SIZE,
  countryFacetId = null,
} = {}) => fetchJsonWithRetry(JOBS_API_URL, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/json',
    Origin: WORKDAY_ORIGIN,
    Referer: WORKDAY_BOARD_URL,
  },
  body: countryFacetId
    ? buildIndiaJobsRequestBody({ offset, limit, countryFacetId })
    : buildUnfilteredJobsRequestBody({ offset, limit }),
  attempts: 1,
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHavasIndiaScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxPages = Number.POSITIVE_INFINITY,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJobsPage = defaultFetchJobsPage,
    now = defaultNow,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Havas India verified official careers surface changed materially')
    }

    const verifiedBoardUrl = extractVerifiedWorkdayBoardUrl(careersPage.html)
    if (!sameUrl(verifiedBoardUrl, WORKDAY_BOARD_URL)) {
      throw new Error('Havas India verified Workday handoff changed materially')
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoardPage, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (
      workdayBoardPage.status !== 200
      || !sameUrl(workdayBoardPage.url, WORKDAY_BOARD_URL)
      || !hasOfficialWorkdayBoardSignal(workdayBoardPage.html)
    ) {
      throw new Error('Havas India verified public Workday board changed materially')
    }

    const unfilteredPayload = await fetchJobsPage({
      offset: 0,
      limit: PAGE_SIZE,
      countryFacetId: null,
    })
    const countryFacetId = extractIndiaCountryFacetId(unfilteredPayload)
    const scrapedAt = now()
    const jobs = []
    const seenJobIds = new Set()
    let offset = 0

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const payload = await fetchJobsPage({
        offset,
        limit: PAGE_SIZE,
        countryFacetId,
      })
      const postings = extractJobsFromPayload(payload, scrapedAt)

      if (pageNumber === 1 && postings.length === 0) {
        return []
      }

      for (const posting of postings) {
        if (seenJobIds.has(posting.jobId)) {
          continue
        }

        seenJobIds.add(posting.jobId)
        jobs.push(posting)
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

    return mapWithConcurrency(
      jobs,
      DETAIL_FETCH_CONCURRENCY,
      async (job) => {
        try {
          const detailPage = await fetchPage(job.link)
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
            postedAt: detail.postingDate || job.postedAt,
            postingDate: detail.postingDate || job.postingDate || null,
          }
        } catch {
          return job
        }
      },
    )
  },
})

export const run = async (options = {}) => createHavasIndiaScraper().run(options)

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
