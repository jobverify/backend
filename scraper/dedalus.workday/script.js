import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasWorkdayOutageSignal, WorkdayUpstreamOutageError } from '../../scraper-support/myworkday/engine.js'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import DEDALUS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DEDALUS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_OFFERS_URL = PROVIDER_METADATA.officialJobOffersPageUrl
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_INDIA_JOB_URLS = PROVIDER_METADATA.verifiedIndiaJobUrls
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const PAGE_SIZE = 20

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&nbsp;/gi, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchPage = async (url) => ({
  status: 200,
  url,
  html: await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  }),
})

const defaultFetchJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'content-type': 'application/json',
  },
  body,
  label: SOURCE,
  timeoutMs: 20000,
})

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    if (url.origin === 'https://dedalus.wd3.myworkdayjobs.com') {
      url.pathname = url.pathname.replace(/^\/en-US(?=\/|$)/i, '')
    }
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const extractMetaContent = (html = '', property) => normalizeWhitespace(
  String(html ?? '').match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1],
)

const titleCaseMonthIndex = {
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

const formatIsoDateFromHuman = (value) => {
  const match = normalizeWhitespace(value)?.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return null

  const [, dayText, monthText, yearText] = match
  const monthIndex = titleCaseMonthIndex[monthText.toLowerCase()]
  if (!Number.isInteger(monthIndex)) return null

  const date = new Date(Date.UTC(Number.parseInt(yearText, 10), monthIndex, Number.parseInt(dayText, 10)))
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const extractClosingDate = (description) =>
  formatIsoDateFromHuman(description?.match(/Application closing date:\s*([^.]+)/i)?.[1] || null)

const buildDetailUrl = (externalPath) =>
  externalPath ? `${WORKDAY_BOARD_URL}${externalPath}` : null

const buildApplyUrl = (detailUrl) => detailUrl ? `${detailUrl}/apply` : null

const extractJobIdFromDetailUrl = (detailUrl = '') =>
  detailUrl.match(/_(JR\d+(?:-\d+)?)(?:\/)?$/i)?.[1] || null

const normalizeIndiaLocationDescriptor = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^IND\s*-\s*Chennai$/i.test(normalized)) return 'Chennai, India'
  if (/^IND\s*-\s*New Delhi\s*-\s*Noida$/i.test(normalized)) return 'Noida, India'
  return normalized
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const completeEmptyWorkdayInventory = ({
  reportedTotal = 0,
  verifiedAt,
  reason,
} = {}) => attachInventoryEvidence([], {
  status: 'complete-inventory',
  surface: JOBS_API_URL,
  firstParty: true,
  listingComplete: true,
  pagesFetched: 1,
  reportedTotal,
  indiaFacetCount: 0,
  verifiedAt,
  reason,
})

const extractAdditionalLocations = (description = '') => {
  if (/Chennai\s+and\s+Noida,\s*India/i.test(description)) {
    return ['IND - Chennai', 'IND - New Delhi - Noida']
  }

  return []
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*-\s*Dedalus Global\s*<\/title>/i.test(page)
    && normalized.includes('CAREERS')
    && normalized.includes('Join Dedalus and become part of a pioneering industry leader!')
    && normalized.includes('WHY DEDALUS')
    && normalized.includes('CAREER PATH')
    && /Our Job Offers/i.test(page)
}

export const hasOfficialJobOffersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Our Job Offers\s*-\s*Dedalus Global\s*<\/title>/i.test(page)
    && normalized.includes('Our Job Offers')
    && normalized.includes('Join the Dedalus adventure')
    && /Go to open positions/i.test(page)
    && /href=["']https?:\/\/dedalus\.wd3\.myworkdayjobs\.com\/(?:en-US\/)?External["']/i.test(page)
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    if (sameUrl(match[1], WORKDAY_BOARD_URL)) {
      return WORKDAY_BOARD_URL
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const hasLegacyOgTitle = /property=["']og:title["'][^>]*content=["']Careers["']/i.test(page)
  const hasLiveWorkdayShell =
    /Dedalus Group is a leading international healthcare software solutions provider/i.test(page)
    && /tenant:\s*"dedalus"/i.test(page)
    && /siteId:\s*"External"/i.test(page)

  return /rel=["']canonical["'][^>]*href=["']https:\/\/dedalus\.wd3\.myworkdayjobs\.com\/External["']/i.test(page)
    && /property=["']og:title["'][^>]*>/i.test(page)
    && /cx-jobs\.min\.js/i.test(page)
    && (hasLegacyOgTitle || hasLiveWorkdayShell)
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

export const extractIndiaCountryFacetId = (payload = {}) =>
  (payload?.facets || [])
    .find((facet) => facet?.facetParameter === 'locationMainGroup')
    ?.values?.find((facet) => facet?.facetParameter === 'locationCountry')
    ?.values?.find((value) => value?.descriptor === 'India')
    ?.id || null

export const hasVerifiedStaleIndiaDetailShell = (html = '') => {
  const page = String(html ?? '')

  return /<html[^>]+lang=["']en-US["']/i.test(page)
    && /property=["']og:title["'][^>]*>/i.test(page)
    && !/property=["']og:title["'][^>]*content=["'][^"']+\S/i.test(page)
    && !/"addressLocality"\s*:\s*"/i.test(page)
    && !/"datePosted"\s*:\s*"/i.test(page)
}

export const buildIndiaJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
  countryFacetId,
} = {}) => JSON.stringify({
  appliedFacets: {
    locationCountry: [countryFacetId],
  },
  limit,
  offset,
  searchText: '',
})

export const extractJobFromDetailHtml = (html = '', posting = {}, { scrapedAt } = {}) => {
  const detailUrl = posting.detailUrl || extractMetaContent(html, 'og:url')
  const title = extractMetaContent(html, 'og:title') || normalizeWhitespace(posting.title)
  const description = extractMetaContent(html, 'og:description')
  const jobId = posting.jobId || extractJobIdFromDetailUrl(detailUrl)
  const schemaLocation = normalizeWhitespace(
    String(html ?? '').match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1],
  )
  const schemaPostedDate = normalizeWhitespace(
    String(html ?? '').match(/"datePosted"\s*:\s*"([^"]+)"/i)?.[1],
  )
  const extraLocations = extractAdditionalLocations(description)
  const locations = [...new Set([schemaLocation, ...extraLocations].filter(Boolean))]
  const location = normalizeIndiaLocationDescriptor(locations[0] || posting.locationsText)

  if (!title || !detailUrl || !jobId || !location) {
    return null
  }

  return {
    jobId,
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractCity(location),
    locations,
    country: 'India',
    sourceUrl: detailUrl,
    applyUrl: buildApplyUrl(detailUrl),
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: schemaPostedDate || null,
    closingDate: extractClosingDate(description),
    jobDescription: description,
    requisitionId: jobId,
    source: SOURCE,
    link: detailUrl,
    scrapedAt,
  }
}

export const createDedalusScraper = ({
  now: defaultNow = () => new Date().toISOString(),
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
      throw new Error('Dedalus verified official careers surface changed materially')
    }

    const jobOffersPage = await fetchPage(JOB_OFFERS_URL)
    if (
      jobOffersPage.status !== 200
      || !sameUrl(jobOffersPage.url, JOB_OFFERS_URL)
      || !hasOfficialJobOffersPageSignal(jobOffersPage.html)
    ) {
      throw new Error('Dedalus verified job offers handoff changed materially')
    }

    const verifiedBoardUrl = extractVerifiedWorkdayBoardUrl(jobOffersPage.html)
    if (!sameUrl(verifiedBoardUrl, WORKDAY_BOARD_URL)) {
      throw new Error('Dedalus verified Workday handoff changed materially')
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    if (hasWorkdayOutageSignal(workdayBoardPage)) {
      throw new WorkdayUpstreamOutageError(`[${SOURCE}] Workday is currently unavailable upstream at ${WORKDAY_BOARD_URL}`)
    }
    if (workdayBoardPage.status !== 200) {
      throw new Error(`HTTP ${workdayBoardPage.status} for ${WORKDAY_BOARD_URL}`)
    }
    if (
      workdayBoardPage.status !== 200
      || !sameUrl(workdayBoardPage.url, WORKDAY_BOARD_URL)
      || !hasOfficialWorkdayBoardSignal(workdayBoardPage.html)
    ) {
      throw new Error('Dedalus verified public Workday board changed materially')
    }

    const unfilteredPayload = await fetchJson(
      JOBS_API_URL,
      buildUnfilteredJobsRequestBody({ offset: 0 }),
    )
    const countryFacetId = extractIndiaCountryFacetId(unfilteredPayload)
    if (!countryFacetId) {
      for (const staleIndiaUrl of VERIFIED_INDIA_JOB_URLS) {
        const staleIndiaPage = await fetchPage(staleIndiaUrl)
        if (
          staleIndiaPage.status !== 200
          || !hasVerifiedStaleIndiaDetailShell(staleIndiaPage.html)
          || extractJobFromDetailHtml(staleIndiaPage.html, { detailUrl: staleIndiaUrl }, { scrapedAt: now() })
        ) {
          throw new Error('Dedalus verified India-empty Workday sentinel changed materially')
        }
      }

      return completeEmptyWorkdayInventory({
        reportedTotal: Number.isInteger(unfilteredPayload?.total) ? unfilteredPayload.total : 0,
        verifiedAt: now(),
        reason: 'dedalus-workday-board-without-india-country-facet',
      })
    }

    const filteredPayload = await fetchJson(
      JOBS_API_URL,
      buildIndiaJobsRequestBody({ offset: 0, countryFacetId }),
    )
    const postings = Array.isArray(filteredPayload?.jobPostings) ? filteredPayload.jobPostings : []
    if (postings.length === 0) {
      return completeEmptyWorkdayInventory({
        reportedTotal: Number.isInteger(filteredPayload?.total) ? filteredPayload.total : 0,
        verifiedAt: now(),
        reason: 'dedalus-workday-india-filter-empty',
      })
    }

    const scrapedAt = now()
    const jobs = []

    for (const posting of postings) {
      const detailUrl = buildDetailUrl(posting.externalPath)
      const detailPage = await fetchPage(detailUrl)
      const job = extractJobFromDetailHtml(detailPage.html, {
        ...posting,
        detailUrl,
        jobId: Array.isArray(posting.bulletFields) ? posting.bulletFields[0] : null,
      }, { scrapedAt })

      if (!job) {
        throw new Error(`Dedalus verified India detail page changed materially: ${detailUrl}`)
      }

      jobs.push({
        ...job,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'dedalus.com',
        atsPlatform: 'workday',
      })
    }

    return jobs.sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createDedalusScraper(options).run(options)

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
