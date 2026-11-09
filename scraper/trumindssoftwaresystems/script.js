import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { hydrateTurboHireJobs } from '../../scraper-support/utils/turboHireDetails.js'

import { TRUMINDS_SOFTWARE_SYSTEMS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export { PROVIDER_METADATA }
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ORIGIN = 'https://truminds.turbohire.co'
export const ORG_ID = PROVIDER_METADATA.orgId
export const BOARD_URL = PROVIDER_METADATA.handoffBoardUrl
export const API_BASE_URL = 'https://thapi.azurewebsites.net'
export const NOAUTH_TOKEN_URL = `${API_BASE_URL}/api/token/noauth`
export const FILTERED_JOBS_URL = `${API_BASE_URL}/api/careerpagev2/filteredjobs?orgId=${ORG_ID}&pageType=0`

const DEFAULT_HEADERS = {
  Origin: ORIGIN,
  Referer: BOARD_URL,
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json, text/plain, */*',
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

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /Truminds \| Careers at Truminds \| Join Our Innovation-Driven Team/i.test(normalized)
    && /\bJob Positions\b/i.test(normalized)
    && /creative-MINDS/i.test(normalized)
    && /View Job Positions/i.test(normalized)
}

export const extractTurboHireHandoffUrl = (html) => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/truminds\.turbohire\.co\/careerpage\/2b7541be-4b35-4cd3-8ba3-09173acb3de9)["']/i,
  )
  return normalizeWhitespace(match?.[1]) || null
}

export const hasOfficialBoardSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Truminds Software Systems Private Limited\s*<\/title>/i.test(page)
    && /You need to enable JavaScript to run this app\./i.test(page)
}

export const extractPublicJobs = (payload = {}) =>
  (Array.isArray(payload?.Result) ? payload.Result : [])
    .map((record) => {
      const title = normalizeWhitespace(record?.JobTitle)
      const location = extractPrimaryLocation(record?.Location)
      const sourceUrl = buildPublicJobUrl(normalizeWhitespace(record?.JobIdObfuscated))

      if (!title || !location || !sourceUrl || !isIndiaLocation(location)) return null

      return {
        title,
        company: PROVIDER_METADATA.companyName,
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

const defaultFetchText = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    redirect: 'error',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
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

export const createTrumindsSoftwareSystemsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson
    const now = options.now || (() => new Date().toISOString())
    const { signal } = options
    signal?.throwIfAborted()

    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Truminds official careers page no longer matches the verified public surface')
    }

    const handoffUrl = extractTurboHireHandoffUrl(careersHtml)
    if (handoffUrl !== BOARD_URL) {
      throw new Error('Truminds official careers page no longer exposes the verified TurboHire handoff')
    }

    const boardHtml = await fetchText(BOARD_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialBoardSignal(boardHtml)) {
      throw new Error('The official Truminds TurboHire board no longer matches the verified public surface')
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
      body: '{}',
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

    return hydrateTurboHireJobs({ source: SOURCE, orgId: ORG_ID, employer: PROVIDER_METADATA.officialBrandName,
      origin: ORIGIN, apiBaseUrl: API_BASE_URL, boardUrl: BOARD_URL, payload: listingsPayload, jobs,
      fetchJson, headers: buildAuthenticatedHeaders(tokenPayload?.access_token),
      listingUrl: FILTERED_JOBS_URL, listingRequest, maxJobs, signal, now })
  },
})

export const SOURCE = PROVIDER_METADATA.source
export const run = async (options = {}) => createTrumindsSoftwareSystemsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
  }
}
