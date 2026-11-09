import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = 'C2FO'
export const SOURCE = 'c2fo'
export const DAYFORCE_ORIGIN = 'https://jobs.dayforcehcm.com'
export const DAYFORCE_CLIENT_NAMESPACE = 'c2fo'
export const DAYFORCE_JOB_BOARD_CODE = 'CANDIDATEPORTAL'
export const DAYFORCE_JOB_BOARD_ID = 1
export const DAYFORCE_LOCALE = 'en-US'
export const OFFICIAL_CAREERS_URL = 'https://c2fo.com/careers/'
export const OFFICIAL_DAYFORCE_URL = `${DAYFORCE_ORIGIN}/${DAYFORCE_LOCALE}/${DAYFORCE_CLIENT_NAMESPACE}/${DAYFORCE_JOB_BOARD_CODE}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_PAGE_SIZE = 20

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const stripTags = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (normalized) return normalized
  }

  return null
}

const normalizeCountryCode = (value) => normalizeWhitespace(value)?.toUpperCase() || null

const getPostingLocations = (posting = {}) => {
  if (Array.isArray(posting.postingLocations)) return posting.postingLocations
  if (Array.isArray(posting.locations)) return posting.locations
  return []
}

const isIndiaLocation = (location = {}) => {
  const countryCode = normalizeCountryCode(location.isoCountryCode || location.countryCode)
  const address = normalizeWhitespace(location.formattedAddress || location.location)

  return countryCode === 'IN' || /\bindia\b/i.test(address || '')
}

const isIndiaPosting = (posting = {}) => {
  const locations = getPostingLocations(posting)
  if (locations.some((location) => isIndiaLocation(location))) {
    return true
  }

  const locationText = firstNonEmpty(
    posting.location,
    posting.formattedAddress,
    posting.searchLocation,
  )
  return /\bindia\b/i.test(locationText || '')
}

const getPrimaryLocation = (posting = {}) => {
  const [firstLocation] = getPostingLocations(posting)
  return firstLocation || null
}

const getCity = (posting = {}) => {
  const location = getPrimaryLocation(posting)
  return firstNonEmpty(location?.cityName, posting.city)
}

const getFormattedLocation = (posting = {}) => {
  const location = getPrimaryLocation(posting)
  return firstNonEmpty(
    location?.formattedAddress,
    posting.location,
    [location?.cityName, location?.stateCode, location?.countryName].filter(Boolean).join(', '),
  )
}

const getPostingId = (posting = {}) => firstNonEmpty(
  posting.jobPostingId,
  posting.jobId,
  posting.id,
)

const getRequisitionId = (posting = {}) => firstNonEmpty(
  posting.jobReqId,
  posting.reqId,
  getPostingId(posting),
)

const getAttributeValue = (attributes, names) => {
  const normalizedNames = names.map((name) => name.toLowerCase())

  if (Array.isArray(attributes)) {
    for (const attribute of attributes) {
      const key = normalizeWhitespace(
        attribute?.name
        || attribute?.attributeName
        || attribute?.key
        || attribute?.label,
      )?.toLowerCase()

      if (!key || !normalizedNames.includes(key)) continue

      return firstNonEmpty(
        attribute?.value,
        attribute?.displayValue,
        attribute?.description,
        Array.isArray(attribute?.values) ? attribute.values[0] : null,
      )
    }
  }

  if (attributes && typeof attributes === 'object') {
    for (const name of names) {
      const value = attributes[name]
        ?? attributes[name.toLowerCase()]
        ?? attributes[name.toUpperCase()]
      const normalized = firstNonEmpty(
        value?.value,
        value?.displayValue,
        value?.description,
        value,
      )
      if (normalized) return normalized
    }
  }

  return null
}

const joinHtmlFragments = (...fragments) => {
  const parts = fragments
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)

  return parts.length ? parts.join('\n') : null
}

const extractExperienceRequired = (...values) => {
  for (const value of values) {
    const html = String(value ?? '')
    const htmlMatch = html.match(/Experience(?:<\/strong>)?\s*:?\s*([^<\n]+)/i)
    if (htmlMatch?.[1]) {
      return normalizeWhitespace(htmlMatch[1])
    }

    const textMatch = (stripTags(html) || '').match(/Experience\s*:?\s*([^|]+?)(?:Location\s*:|$)/i)
    if (textMatch?.[1]) {
      return normalizeWhitespace(textMatch[1])
    }
  }

  return null
}

const extractDetailPayload = (payload = {}) => (
  payload?.jobPostingInfo
  || payload?.pageProps?.jobPostingInfo
  || payload?.props?.pageProps?.jobPostingInfo
  || payload
)

const extractSiteContext = (payload = {}) => (
  payload?.siteInfo
  || payload?.pageProps?.siteInfo
  || payload?.props?.pageProps?.siteInfo
  || payload
)

const getTotalCount = (payload = {}) => {
  const count = payload?.totalCount
    ?? payload?.totalJobCount
    ?? payload?.count
    ?? payload?.maxCount
  return Number.isFinite(count) ? count : Number.parseInt(count, 10) || 0
}

export const buildSiteContextUrl = () =>
  `${DAYFORCE_ORIGIN}/api/geo/${DAYFORCE_CLIENT_NAMESPACE}/sitecontext/${DAYFORCE_CLIENT_NAMESPACE}/${DAYFORCE_JOB_BOARD_CODE}/${DAYFORCE_LOCALE}`

export const buildCsrfUrl = () => `${DAYFORCE_ORIGIN}/api/auth/csrf`

export const buildSearchApiUrl = () =>
  `${DAYFORCE_ORIGIN}/api/geo/${DAYFORCE_CLIENT_NAMESPACE}/jobposting/search`

export const buildJobDetailApiUrl = (jobPostingId) =>
  `${DAYFORCE_ORIGIN}/api/geo/${DAYFORCE_CLIENT_NAMESPACE}/jobposting/${DAYFORCE_CLIENT_NAMESPACE}/${DAYFORCE_LOCALE}/${DAYFORCE_JOB_BOARD_ID}/${jobPostingId}`

export const buildJobDetailUrl = (jobPostingId) => `${OFFICIAL_DAYFORCE_URL}/jobs/${jobPostingId}`

export const extractCookieHeaderFromResponse = (response) => {
  const headers = response?.headers
  if (!headers) return null

  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : String(headers.get?.('set-cookie') || '')
      .split(/,(?=\s*[^;,=\s]+=[^;]+)/)
      .filter(Boolean)

  const cookieHeader = setCookies
    .map((line) => normalizeWhitespace(String(line).split(';')[0]))
    .filter(Boolean)
    .join('; ')

  return cookieHeader || null
}

export const buildDayforceSessionHeaders = (
  session = {},
  { includeContentType = false } = {},
) => ({
  'User-Agent': USER_AGENT,
  Accept: 'application/json,text/plain,*/*',
  Cookie: session.cookieHeader,
  'X-CSRF-Token': session.csrfToken,
  Referer: OFFICIAL_DAYFORCE_URL,
  Origin: DAYFORCE_ORIGIN,
  ...(includeContentType ? { 'Content-Type': 'application/json;charset=UTF-8' } : {}),
})

export const buildSearchRequestPayload = (paginationStart = 0) => ({
  clientNamespace: DAYFORCE_CLIENT_NAMESPACE,
  jobBoardCode: DAYFORCE_JOB_BOARD_CODE,
  cultureCode: DAYFORCE_LOCALE,
  distanceUnit: 0,
  paginationStart,
})

export const extractOfficialDayforceUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/jobs\.dayforcehcm\.com\/en-US\/c2fo\/CANDIDATEPORTAL/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialC2foCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Careers - C2FO'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/c2fo\.com\/careers\/["']/i.test(page)
    && /do work that matters with a team that cares/i.test(text)
    && /career opportunities available around the globe/i.test(text)
    && /browse open positions/i.test(text)
    && extractOfficialDayforceUrl(page) === OFFICIAL_DAYFORCE_URL
}

export const hasVerifiedDayforceSiteContext = (payload = {}) => {
  const siteContext = extractSiteContext(payload)

  return normalizeWhitespace(siteContext?.clientNamespace)?.toLowerCase() === DAYFORCE_CLIENT_NAMESPACE
    && normalizeWhitespace(siteContext?.jobBoardCode)?.toLowerCase() === DAYFORCE_JOB_BOARD_CODE.toLowerCase()
    && Number(siteContext?.jobBoardId) === DAYFORCE_JOB_BOARD_ID
}

export const extractSearchPostings = (payload = {}) => {
  if (Array.isArray(payload?.postings)) return payload.postings
  if (Array.isArray(payload?.jobPostings)) return payload.jobPostings
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export const normalizeSearchPosting = (posting = {}) => {
  if (!isIndiaPosting(posting)) return null

  const jobPostingId = getPostingId(posting)
  if (!jobPostingId) return null

  return {
    title: firstNonEmpty(posting.jobTitle, posting.title),
    location: getFormattedLocation(posting),
    city: getCity(posting),
    jobId: String(jobPostingId),
    requisitionId: String(getRequisitionId(posting)),
    department: null,
    employmentType: null,
    experienceRequired: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: firstNonEmpty(posting.postingStartTimestampUTC, posting.postedDate),
    closingDate: firstNonEmpty(posting.postingExpiryTimestampUTC, posting.closingDate),
    sourceUrl: buildJobDetailUrl(jobPostingId),
    applyUrl: buildJobDetailUrl(jobPostingId),
  }
}

export const normalizeJobDetail = (payload = {}, listing = {}) => {
  const detail = extractDetailPayload(payload)
  const locations = getPostingLocations(detail)
  const posting = {
    ...detail,
    postingLocations: locations.length ? locations : getPostingLocations(listing),
  }
  const description = joinHtmlFragments(
    detail.jobDescriptionHeader,
    detail.jobDescription,
    detail.jobDescriptionFooter,
  )
  const jobId = getPostingId(detail) || listing.jobId
  const requisitionId = getRequisitionId(detail) || listing.requisitionId
  const attributes = detail.jobPostingAttributes

  return {
    title: firstNonEmpty(detail.jobTitle, listing.title),
    location: firstNonEmpty(getFormattedLocation(posting), listing.location),
    city: firstNonEmpty(getCity(posting), listing.city),
    jobId: jobId ? String(jobId) : null,
    requisitionId: requisitionId ? String(requisitionId) : null,
    department: firstNonEmpty(
      getAttributeValue(attributes, ['JobFamily', 'Department', 'JobFunction']),
      listing.department,
    ),
    employmentType: firstNonEmpty(
      detail.employmentType,
      getAttributeValue(attributes, ['EmploymentType', 'WorkerType', 'TimeType']),
      listing.employmentType,
    ),
    experienceRequired: firstNonEmpty(
      extractExperienceRequired(detail.jobDescriptionHeader, detail.jobDescription),
      listing.experienceRequired,
    ),
    jobDescription: description || listing.jobDescription || null,
    minimumQualification: listing.minimumQualification || null,
    preferredQualification: listing.preferredQualification || null,
    requiredSkills: Array.isArray(detail.requiredSkills) ? detail.requiredSkills : listing.requiredSkills || [],
    postingDate: firstNonEmpty(detail.postingStartTimestampUTC, listing.postingDate),
    closingDate: firstNonEmpty(detail.postingExpiryTimestampUTC, listing.closingDate),
    sourceUrl: listing.sourceUrl || (jobId ? buildJobDetailUrl(jobId) : null),
    applyUrl: listing.applyUrl || (jobId ? buildJobDetailUrl(jobId) : null),
  }
}

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY_NAME,
    companyCareerPage: OFFICIAL_CAREERS_URL,
    baseUrl: OFFICIAL_DAYFORCE_URL,
    adapter: 'script',
    atsPlatform: 'dayforce',
    countryFilter: 'India',
    paginationStrategy: 'paginationStart-offset-dayforce-search',
    extractionStrategy: 'official-careers-handoff+dayforce-jobposting-search+detail-api',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'c2fo.com',
  },
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'c2fo-official',
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  label: options.label || 'c2fo-json',
  timeoutMs: options.timeoutMs || 15000,
})

export const createDayforceSession = async ({
  fetchJson = defaultFetchJson,
} = {}) => {
  let csrfResponse = null
  const payload = await fetchJson(buildCsrfUrl(), {
    label: 'c2fo-dayforce-csrf',
    fetchImpl: async (url, requestInit) => {
      const response = await fetch(url, requestInit)
      csrfResponse = response
      return response
    },
  })

  const csrfToken = firstNonEmpty(payload?.csrfToken)
  const cookieHeader = extractCookieHeaderFromResponse(csrfResponse)

  if (!csrfToken || !cookieHeader) {
    throw new Error('C2FO Dayforce public session bootstrap no longer exposes a CSRF token and cookie contract')
  }

  return {
    csrfToken,
    cookieHeader,
  }
}

export const createC2foScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    createDayforceSessionImpl = createDayforceSession,
    searchJobPostings,
    fetchJobDetail,
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 1,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : Number.POSITIVE_INFINITY,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialC2foCareersSignals(careersHtml)) {
      throw new Error('C2FO verified official careers page no longer matches the verified Dayforce public surface')
    }

    const siteContext = await fetchJson(buildSiteContextUrl(), {
      label: 'c2fo-sitecontext',
    })

    if (!hasVerifiedDayforceSiteContext(siteContext)) {
      throw new Error('C2FO verified Dayforce public jobs surface no longer matches the pinned C2FO site context')
    }

    let dayforceSessionPromise = null
    const getDayforceSession = async () => {
      if (!dayforceSessionPromise) {
        dayforceSessionPromise = Promise.resolve(createDayforceSessionImpl({ fetchJson }))
      }

      return dayforceSessionPromise
    }

    const sessionFreeSearchJobPostings = searchJobPostings || (async (payload) => {
      const session = await getDayforceSession()
      return fetchJson(buildSearchApiUrl(), {
        method: 'POST',
        headers: buildDayforceSessionHeaders(session, { includeContentType: true }),
        body: JSON.stringify(payload),
        label: 'c2fo-dayforce-search',
      })
    })

    const sessionFreeFetchJobDetail = fetchJobDetail || (async (jobPostingId) => {
      const session = await getDayforceSession()
      return fetchJson(buildJobDetailApiUrl(jobPostingId), {
        headers: buildDayforceSessionHeaders(session),
        label: `c2fo-dayforce-detail-${jobPostingId}`,
      })
    })

    const jobs = []
    const seenJobIds = new Set()
    let paginationStart = 0

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const searchPayload = await sessionFreeSearchJobPostings(buildSearchRequestPayload(paginationStart))
      const postings = extractSearchPostings(searchPayload)
      if (!postings.length) break

      for (const posting of postings) {
        const listing = normalizeSearchPosting(posting)
        if (!listing?.jobId || seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        let detail = listing
        try {
          const detailPayload = await sessionFreeFetchJobDetail(listing.jobId)
          detail = {
            ...detail,
            ...normalizeJobDetail(detailPayload, listing),
          }
        } catch {
          detail = {
            ...listing,
          }
        }

        jobs.push({
          title: detail.title,
          company: COMPANY_NAME,
          department: detail.department,
          location: detail.location,
          city: detail.city,
          jobId: detail.jobId,
          requisitionId: detail.requisitionId,
          sourceUrl: detail.sourceUrl,
          applyUrl: detail.applyUrl,
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate,
          closingDate: detail.closingDate,
          jobDescription: detail.jobDescription,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: now(),
        })

        if (jobs.length >= maxJobs) return jobs
      }

      const totalCount = getTotalCount(searchPayload)
      const pageSize = postings.length || DEFAULT_PAGE_SIZE
      paginationStart += pageSize

      if (pageSize < DEFAULT_PAGE_SIZE) break
      if (totalCount && paginationStart >= totalCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createC2foScraper().run(options)

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
