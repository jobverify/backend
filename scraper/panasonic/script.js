import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { PANASONIC_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = PANASONIC_CATALOG
export const SOURCE = PANASONIC_CATALOG.source
export const COMPANY = PANASONIC_CATALOG.companyName
export const COUNTRY_FILTER = PANASONIC_CATALOG.countryFilter
export const OFFICIAL_CAREERS_URL = PANASONIC_CATALOG.companyCareerPage
export const OFFICIAL_INDIA_CORPORATE_PAGE_URL = PANASONIC_CATALOG.officialIndiaCorporatePageUrl
export const OFFICIAL_GLOBAL_CAREERS_URL = PANASONIC_CATALOG.officialGlobalCareersUrl
export const OFFICIAL_CORPORATE_CAREERS_URL = PANASONIC_CATALOG.officialCorporateCareersUrl
export const OFFICIAL_LOCATIONS_URL = PANASONIC_CATALOG.officialLocationsUrl
export const OFFICIAL_JOBS_API_URL = PANASONIC_CATALOG.officialJobsApiUrl
export const VERIFIED_ON = PANASONIC_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PANASONIC_CATALOG.verifiedSurfaceSummary
export const DEFAULT_PAGE_SIZE = 10

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const DEFAULT_SEARCH_CONFIG = {
  query: {
    country: COUNTRY_FILTER,
    internal: 'false',
    allLangs: 'true',
    dedupeLang: 'en-us|en-us',
    separator: '|',
    facetField: 'tags1|tags2|tags3|tags4',
  },
  path: '/corporate/jobs/locations/country/India',
  numRowsPerPage: DEFAULT_PAGE_SIZE,
  contextSettings: {
    currentContext: 'corporate',
  },
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null)

const extractWindowValue = (html, propertyName) =>
  normalizeWhitespace(
    String(html ?? '').match(
      new RegExp(`window\\.${propertyName}\\s*=\\s*['"]([^'"]+)['"]`, 'i'),
    )?.[1] ?? null,
  )

export const extractOfficialSearchConfig = (html) => {
  const match = String(html ?? '').match(/window\.searchConfig\s*=\s*({[\s\S]*?})\s*;/i)
  if (!match?.[1]) {
    return null
  }

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const getCorporateContextDefinition = (searchConfig = {}) =>
  Array.isArray(searchConfig?.contextSettings?.contextDefinitions)
    ? searchConfig.contextSettings.contextDefinitions.find(
      (definition) => normalizeWhitespace(definition?.name) === 'corporate',
    ) ?? null
    : null

export const hasOfficialPanasonicCareersSignals = (html) => {
  const rawHtml = String(html ?? '')
  const searchConfig = extractOfficialSearchConfig(rawHtml)
  const corporateContextDefinition = getCorporateContextDefinition(searchConfig)
  const normalizedPage = normalizeWhitespace(rawHtml) || ''
  const hasCorporateLandingIdentity = normalizedPage.includes('Panasonic Corporation of North America Careers')
    || normalizeWhitespace(searchConfig?.pageTitle) === 'Panasonic Corporate Careers'
    || normalizeWhitespace(searchConfig?.searchPageHeader) === 'corporate Job Search'
    || normalizeWhitespace(corporateContextDefinition?.metadata?.title) === 'Panasonic Corporate Careers'

  return extractTitle(rawHtml) === 'Panasonic Corporate Careers'
    && hasCorporateLandingIdentity
    && extractWindowValue(rawHtml, 'currentContext') === 'corporate'
    && extractWindowValue(rawHtml, 'currentContextValue') === 'corporate'
    && searchConfig?.path === DEFAULT_SEARCH_CONFIG.path
    && normalizeWhitespace(searchConfig?.query?.country) === COUNTRY_FILTER
    && searchConfig?.contextSettings?.currentContext === 'corporate'
    && Number(searchConfig?.numRowsPerPage) === DEFAULT_PAGE_SIZE
}

export const buildIndiaJobsApiUrl = ({
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  searchConfig = DEFAULT_SEARCH_CONFIG,
} = {}) => {
  const url = new URL(OFFICIAL_JOBS_API_URL)
  const query = {
    ...DEFAULT_SEARCH_CONFIG.query,
    ...(searchConfig?.query || {}),
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '') return
    url.searchParams.set(key, String(value))
  })

  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))
  return url.toString()
}

export const extractJobsPayload = (payload = {}) => {
  if (!Array.isArray(payload.jobs)) {
    throw new Error('Panasonic public jobs api no longer exposes the expected jobs array')
  }

  return {
    jobs: payload.jobs,
    totalCount: Number.isInteger(payload.totalCount) ? payload.totalCount : payload.jobs.length,
    count: Number.isInteger(payload.count) ? payload.count : payload.jobs.length,
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/full[_\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[_\s-]?time/i.test(normalized)) return 'Part-time'
  if (/contract/i.test(normalized)) return 'Contract'
  if (/intern/i.test(normalized)) return 'Internship'
  return normalized
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  const explicitDate = normalized.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  return explicitDate || null
}

const isIndiaJob = (job = {}) => {
  const country = normalizeWhitespace(job.country)
  const countryCode = normalizeWhitespace(job.country_code)?.toUpperCase()
  return country === COUNTRY_FILTER || countryCode === 'IN'
}

const getLocation = (job = {}) =>
  normalizeWhitespace(job.full_location)
  || normalizeWhitespace(job.location_name?.replaceAll('-', ', '))
  || normalizeWhitespace([job.city, job.state, job.country].filter(Boolean).join(', '))

const getDepartment = (job = {}) =>
  normalizeWhitespace(job.categories?.[0]?.name)
  || normalizeWhitespace(job.category?.[0])
  || normalizeWhitespace(job.category)

const buildCanonicalJobUrl = (job = {}) => {
  const canonicalUrl = normalizeWhitespace(job.canonical_url)
  if (canonicalUrl) return canonicalUrl

  const slug = normalizeWhitespace(job.slug || job.req_id)
  return slug ? `https://careers.na.panasonic.com/jobs/${slug}?lang=en-us` : null
}

export const normalizeJobListing = (item = {}) => {
  const job = item?.data || item
  if (!isIndiaJob(job)) return null

  const title = normalizeWhitespace(job.title)
  const jobId = normalizeWhitespace(job.req_id || job.slug)

  if (!title || !jobId) return null

  return {
    title,
    location: getLocation(job),
    city: normalizeWhitespace(job.city),
    country: normalizeWhitespace(job.country) || COUNTRY_FILTER,
    jobId,
    requisitionId: jobId,
    department: getDepartment(job),
    employmentType: normalizeEmploymentType(job.employment_type || job.tags1?.[0]),
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(job.qualifications),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizePostingDate(job.posted_date),
    closingDate: normalizePostingDate(job.posting_expiry_date),
    jobDescription: normalizeWhitespace(job.description || job.responsibilities),
    applyUrl: normalizeWhitespace(job.apply_url),
    sourceUrl: buildCanonicalJobUrl(job),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'panasonic-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: OFFICIAL_CAREERS_URL,
  },
  label: 'panasonic-jobs',
  timeoutMs: 15000,
})

export const createPanasonicScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialPanasonicCareersSignals(careersHtml)) {
      throw new Error('Panasonic verified corporate India careers route no longer matches the trusted public surface')
    }

    const searchConfig = extractOfficialSearchConfig(careersHtml)
    if (!searchConfig) {
      throw new Error('Panasonic verified corporate India careers route no longer exposes the public search config')
    }

    const pageSize = Number.isInteger(searchConfig.numRowsPerPage)
      ? searchConfig.numRowsPerPage
      : DEFAULT_PAGE_SIZE
    const jobs = []
    const seenJobIds = new Set()
    const scrapedAt = now()

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = extractJobsPayload(
        await fetchJson(
          buildIndiaJobsApiUrl({
            page,
            limit: pageSize,
            searchConfig,
          }),
        ),
      )

      if (!payload.jobs.length) {
        break
      }

      for (const item of payload.jobs) {
        const normalized = normalizeJobListing(item)
        if (!normalized?.jobId || seenJobIds.has(normalized.jobId)) continue
        seenJobIds.add(normalized.jobId)

        jobs.push({
          ...normalized,
          company: COMPANY,
          source: SOURCE,
          link: normalized.applyUrl || normalized.sourceUrl,
          scrapedAt,
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (payload.jobs.length < pageSize) break
      if (payload.totalCount && jobs.length >= payload.totalCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createPanasonicScraper().run(options)

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
