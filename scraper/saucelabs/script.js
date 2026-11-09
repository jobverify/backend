import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

import SAUCE_LABS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SAUCE_LABS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl
export const FIRST_PARTY_DETAIL_URL_BASE = PROVIDER_METADATA.officialCareersDetailUrlBase

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) => normalizeWhitespace(
  decodeHtmlEntities(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null),
)

const normalizeText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&'),
)?.toLowerCase() || ''

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeDepartment = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized?.replace(/^\d+\s*:\s*/, '') || null
}

const getOfficeLocations = (job = {}) => (Array.isArray(job?.offices) ? job.offices : [])
  .flatMap((office) => [
    normalizeWhitespace(office?.location),
    normalizeWhitespace(office?.name),
  ])
  .filter(Boolean)

const isIndiaLocation = (value) => /\bIndia\b/i.test(normalizeWhitespace(value) || '')

const getIndiaLocations = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  const officeLocations = getOfficeLocations(job)

  return [
    primaryLocation,
    ...officeLocations,
  ].filter((location, index, values) => location && values.indexOf(location) === index)
    .filter((location) => isIndiaLocation(location))
}

const deriveDisplayLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  if (isIndiaLocation(primaryLocation)) return primaryLocation

  return getIndiaLocations(job)[0] || null
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /\bremote\b/i.test(normalized)) return null

  return normalized.split(',')[0]?.trim() || null
}

const deriveRemoteStatus = (locations) => {
  const hasRemote = locations.some((location) => /\bremote\b/i.test(location))
  const hasOffice = locations.some((location) => !/\bremote\b/i.test(location))

  if (hasRemote && hasOffice) return 'Hybrid'
  if (hasRemote) return 'Remote'
  return 'On-site'
}

const normalizeGreenhouseAbsoluteUrl = (value, jobId) => {
  const normalizedId = normalizeWhitespace(jobId)
  if (!normalizedId) return null

  try {
    const url = new URL(String(value ?? ''))
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/g, '')

    if (hostname !== 'job-boards.greenhouse.io') return null
    if (pathname !== `/saucelabs/jobs/${normalizedId}`) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${normalizedId}`
  } catch {
    return null
  }
}

export const buildFirstPartyDetailUrl = (jobId) =>
  `${FIRST_PARTY_DETAIL_URL_BASE}${encodeURIComponent(String(jobId ?? ''))}`

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return extractTitle(page) === 'Sauce Labs Careers & Opportunities'
    && normalized.includes('see openings')
    && normalized.includes('current positions at sauce labs')
    && normalized.includes('departments')
    && normalized.includes('locations')
}

const normalizeCompanyName = (value) => normalizeWhitespace(value)
  ?.replace(/\binc\.?$/i, '')
  .trim()
  .toLowerCase() || null

const getValidatedJobs = (payload) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Verified Sauce Labs greenhouse payload changed materially')
  }

  for (const job of jobs) {
    const jobId = normalizeWhitespace(job?.id)
    const title = normalizeWhitespace(job?.title)
    const absoluteUrl = normalizeGreenhouseAbsoluteUrl(job?.absolute_url, jobId)
    const companyName = normalizeCompanyName(job?.company_name)

    if (!jobId || !title || !absoluteUrl) {
      throw new Error('Verified Sauce Labs greenhouse payload changed materially')
    }

    if (companyName && companyName !== COMPANY.toLowerCase()) {
      throw new Error('Verified Sauce Labs greenhouse payload changed materially')
    }
  }

  return jobs
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => getValidatedJobs(payload)
  .map((job) => {
    const jobId = normalizeWhitespace(job?.id)
    const indiaLocations = getIndiaLocations(job)

    if (!jobId || indiaLocations.length === 0) {
      return null
    }

    const location = deriveDisplayLocation(job)
    const firstPartyDetailUrl = buildFirstPartyDetailUrl(jobId)

    return {
      title: normalizeWhitespace(job?.title),
      company: COMPANY,
      department: normalizeDepartment(job?.departments?.[0]?.name),
      location,
      city: deriveCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: firstPartyDetailUrl,
      applyUrl: firstPartyDetailUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(job?.first_published || job?.updated_at),
      closingDate: null,
      jobDescription: decodeHtmlEntities(job?.content) || null,
      remoteStatus: deriveRemoteStatus(indiaLocations),
      source: SOURCE,
      link: firstPartyDetailUrl,
      scrapedAt,
    }
  })
  .filter(Boolean)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSauceLabsScraper = ({
  maxJobs = null,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const indiaJobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(GREENHOUSE_JOBS_API_URL),
      { scrapedAt: now() },
    )
    const selectedJobs = Number.isInteger(maxJobs) && maxJobs > 0
      ? indiaJobs.slice(0, maxJobs)
      : indiaJobs

    return selectedJobs.map((job) => ({
      ...job,
      companyCareerPage: CAREERS_PAGE_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createSauceLabsScraper(options).run(options)

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
