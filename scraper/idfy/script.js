import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { IDFY_CATALOG } from './catalog.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { hydrateTurboHireJobs } from '../../scraper-support/utils/turboHireDetails.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = IDFY_CATALOG.source
export const COMPANY = IDFY_CATALOG.companyName
export const PROVIDER_METADATA = IDFY_CATALOG
export const OFFICIAL_CAREERS_URL = IDFY_CATALOG.companyCareerPage
export const ORIGIN = 'https://idfy.turbohire.co'
export const ORG_ID = IDFY_CATALOG.turboHireOrgId
export const BOARD_URL = IDFY_CATALOG.handoffBoardUrl
export const API_BASE_URL = 'https://thapi.azurewebsites.net'
export const NOAUTH_TOKEN_URL = `${API_BASE_URL}/api/token/noauth`
export const FILTERED_JOBS_URL =
  `${API_BASE_URL}/api/careerpagev2/filteredjobs?orgId=${ORG_ID}&pageType=0`

const DEFAULT_HEADERS = {
  Origin: ORIGIN,
  Referer: BOARD_URL,
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json, text/plain, */*',
}

const LIVE_FILTER_BODY = {
  SortByV2: { Key: 'PostedDate', Order: 2 },
  BunitIds: { Value: null, FilterType: 0 },
  Experience: { Value: null, FilterType: 0 },
  JobTypes: { Value: null, FilterType: 0 },
  JobTypeV2: { Value: null, FilterType: 0 },
  Locations: { Value: null, FilterType: 0 },
  CreatedDate: { Value: null, FilterType: 0 },
  Compensation: { Value: null, FilterType: 0 },
  Skills: { Value: null, FilterType: 0 },
  Keyword: '',
  ClientIds: { Value: null, FilterType: 0 },
  Department: '',
  CustomFields: {},
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const formatExperience = (experience = {}) => {
  const min = Number.isFinite(experience?.MinExp) ? experience.MinExp : null
  const max = Number.isFinite(experience?.MaxExp) ? experience.MaxExp : null

  if (min != null && max != null) {
    if (min === max) return `${min} year${min === 1 ? '' : 's'}`
    return `${min}-${max} years`
  }

  if (min != null) return `${min}+ years`
  if (max != null) return `Up to ${max} years`
  return null
}

const parseLocations = (value) => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const normalizeLocation = (value) => normalizeWhitespace(value)?.replace(/\s*,\s*/g, ', ') || null

const extractPrimaryLocation = (value) => normalizeLocation(parseLocations(value)[0]?.Address)

const extractCity = (location) => normalizeLocation(location)?.split(',')[0] || null

const isIndiaLocation = (location) => /\bindia\b/i.test(normalizeWhitespace(location) || '')

const buildPublicJobUrl = (jobIdObfuscated) => (
  jobIdObfuscated
    ? `${ORIGIN}/job/publicjobs/${jobIdObfuscated}`
    : null
)

const buildAuthenticatedHeaders = (accessToken = null) => {
  const headers = { ...DEFAULT_HEADERS }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return headers
}

export const isVerifiedBoardUrl = (value) => {
  try {
    return new URL(value).toString() === BOARD_URL
  } catch {
    return false
  }
}

export const hasOfficialBoardSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*IDfy\s*<\/title>/i.test(page)
    && /property=["']og:title["'][^>]+content=["']IDfy - Career Page["']/i.test(page)
    && /property=["']og:site_name["'][^>]+content=["']IDfy["']/i.test(page)
    && /You need to enable JavaScript to run this app\./i.test(page)
}

export const extractOfficialBoardUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = normalizeWhitespace(match[1])
    const text = stripTags(match[2])?.toLowerCase() || ''

    if (isVerifiedBoardUrl(href)) return href
    if (/open roles|see all open roles/i.test(text) && isVerifiedBoardUrl(href)) return href
  }

  return null
}

export const hasOfficialCareersWrapperSignal = (html = '') => {
  const normalized = stripTags(html)?.toLowerCase() || ''

  return normalized.includes('life at idfy')
    && normalized.includes('expect the unexpected')
    && normalized.includes('helping a billion people move through life with trust')
    && normalized.includes('open roles')
    && extractOfficialBoardUrl(html) === BOARD_URL
}

export const buildFilteredJobsRequestBody = () => JSON.stringify(LIVE_FILTER_BODY)

export const extractPublicJobs = (payload = {}) =>
  (Array.isArray(payload?.Result) ? payload.Result : [])
    .map((record) => {
      const title = normalizeWhitespace(record?.JobTitle)
      const location = extractPrimaryLocation(record?.Location)
      const sourceUrl = buildPublicJobUrl(normalizeWhitespace(record?.JobIdObfuscated))

      if (!title || !location || !sourceUrl) return null
      if (!isIndiaLocation(location)) return null
      if (normalizeWhitespace(record?.OrgDetails?.OrgID) !== ORG_ID) return null

      return {
        title,
        company: normalizeWhitespace(record?.OrgDetails?.OrgName) || COMPANY,
        department: normalizeWhitespace(record?.Department),
        location,
        city: extractCity(location),
        country: 'India',
        jobId: normalizeWhitespace(record?.JobId),
        requisitionId: normalizeWhitespace(record?.JobCode) || normalizeWhitespace(record?.JobId),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(record?.JobTypeV2) || null,
        experienceRequired: formatExperience(record?.Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(record?.Skills)
          ? record.Skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
          : [],
        postingDate: normalizeWhitespace(record?.PublishedDate),
        closingDate: normalizeWhitespace(record?.ExpiryDates?.CAREERPAGE),
        jobDescription: stripTags(record?.JobDescV2),
      }
    })
    .filter(Boolean)

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    redirect: 'error',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createIdfyScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage
    const fetchJson = options.fetchJson || defaultFetchJson
    const now = options.now || (() => new Date().toISOString())
    const { signal } = options
    signal?.throwIfAborted()

    const careersPage = await fetchPage(OFFICIAL_CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (careersPage?.status !== 200) {
      throw new Error('IDfy official careers handoff changed; refusing to guess the public jobs source')
    }

    let boardPage = null

    if (isVerifiedBoardUrl(careersPage?.url) && hasOfficialBoardSignal(careersPage?.html)) {
      boardPage = careersPage
    } else if (
      careersPage?.url === OFFICIAL_CAREERS_URL
      && hasOfficialCareersWrapperSignal(careersPage?.html)
    ) {
      boardPage = await fetchPage(BOARD_URL, { signal })
      signal?.throwIfAborted()
    } else {
      throw new Error('IDfy official careers handoff changed; refusing to guess the public jobs source')
    }

    if (
      boardPage?.status !== 200
      || !isVerifiedBoardUrl(boardPage?.url)
      || !hasOfficialBoardSignal(boardPage?.html)
    ) {
      throw new Error('IDfy official careers handoff changed; refusing to guess the public jobs source')
    }

    const tokenPayload = await fetchJson(NOAUTH_TOKEN_URL, {
      method: 'GET',
      headers: buildAuthenticatedHeaders(),
      signal,
    })
    signal?.throwIfAborted()

    const listingRequest = {
      method: 'POST',
      headers: {
        ...buildAuthenticatedHeaders(tokenPayload?.access_token),
        'Content-Type': 'application/json',
      },
      body: buildFilteredJobsRequestBody(),
      signal,
    }
    const listingsPayload = await fetchJson(FILTERED_JOBS_URL, listingRequest)
    signal?.throwIfAborted()

    const jobs = extractPublicJobs(listingsPayload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))

    return hydrateTurboHireJobs({ source: SOURCE, orgId: ORG_ID, employer: COMPANY,
      origin: ORIGIN, apiBaseUrl: API_BASE_URL, boardUrl: BOARD_URL, payload: listingsPayload, jobs,
      fetchJson, headers: buildAuthenticatedHeaders(tokenPayload?.access_token),
      listingUrl: FILTERED_JOBS_URL, listingRequest, maxJobs, signal, now })
  },
})

export const run = async (options = {}) => createIdfyScraper().run(options)

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
