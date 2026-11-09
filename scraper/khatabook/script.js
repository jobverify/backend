import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { KHATABOOK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = KHATABOOK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_SCRIPT_URL = PROVIDER_METADATA.careersScriptUrl
export const CATEGORY_JOBS_API_BASE_URL = PROVIDER_METADATA.categoryJobsApiBaseUrl
export const TURBOHIRE_HOST = PROVIDER_METADATA.publicApplyHost
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const CAREERS_TITLE = 'Careers at Khatabook | Khatabook Jobs | Latest Khatabook Openings'
const INDIA_CITY_FALLBACK_PATTERN = /\b(bengaluru|bangalore|gurugram|gurgaon|mumbai|pune|chennai|hyderabad)\b/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&#x27;|&#39;|&apos;/gi, "'"),
)

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const extractMetaContent = (html = '', attributeName, attributeValue) => {
  const pattern = new RegExp(
    `<meta[^>]+${attributeName}=["']${attributeValue}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+${attributeName}=["']${attributeValue}["']`,
    'i',
  )
  const match = String(html ?? '').match(pattern)
  return normalizeWhitespace(match?.[1] || match?.[2])
}

const extractPageTitle = (html = '') =>
  extractTitle(html)
  || extractMetaContent(html, 'name', 'title')
  || extractMetaContent(html, 'property', 'og:title')

const parseLocationList = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return []

  try {
    const parsed = JSON.parse(normalized)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const isIndiaLikeAddress = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  return /india/i.test(normalized) || INDIA_CITY_FALLBACK_PATTERN.test(normalized)
}

const buildLocationParts = (address = '') => normalizeWhitespace(address)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) ?? []

const extractPrimaryLocation = (job = {}) => {
  const locations = parseLocationList(job.Location)
  const matchingLocation = locations.find((item) => isIndiaLikeAddress(item?.Address)) || locations[0]
  const parts = buildLocationParts(matchingLocation?.Address)
  const city = parts[0] ?? null
  const country = parts.length > 0 ? parts.at(-1) : null
  const location = parts.length > 0 ? parts.join(', ') : null

  return {
    location,
    city,
    country: /india/i.test(country || '') ? 'India' : country,
  }
}

const buildExperienceRequired = (experience = {}) => {
  const min = Number.isFinite(Number(experience?.MinExp)) ? Number(experience.MinExp) : null
  const max = Number.isFinite(Number(experience?.MaxExp)) ? Number(experience.MaxExp) : null

  if (min != null && max != null) {
    return min === max ? `${min} years` : `${min}-${max} years`
  }

  if (min != null) return `${min}+ years`
  if (max != null) return `Up to ${max} years`
  return null
}

const isExpectedApplyUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.origin === TURBOHIRE_HOST && /\/job\/publicjobs\//i.test(url.pathname)
  } catch {
    return false
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return extractPageTitle(page) === CAREERS_TITLE
    && normalized.includes('Search for a Job')
    && normalized.includes('View Openings')
    && /name=["']locations["']/i.test(page)
    && /category-item-bar/i.test(page)
    && /static\/js\/hiring\.js/i.test(page)
}

export const extractCategoryIds = (html = '') =>
  [...String(html ?? '').matchAll(/class=["'][^"']*category-item-bar[^"']*["'][^>]*\sid=["']([^"']+)["']/gi)]
    .map((match) => decodeHtmlEntities(match[1]))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)

export const hasOfficialJobsScriptSignal = (script = '') => {
  const text = String(script ?? '')

  return text.includes("methods.fetchJobs = function(url, cat, index)")
    && text.includes("url = '/hiring/recruiter/list?';")
    && text.includes("url += 'category=' + encodeURIComponent(cat)")
    && text.includes('response.data.Jobs ?? []')
    && text.includes('category-item-bar')
}

export const buildCategoryJobsUrl = (category) => {
  const normalized = normalizeWhitespace(category)
  if (!normalized) return null

  return `${CATEGORY_JOBS_API_BASE_URL}?category=${encodeURIComponent(normalized)}`
}

export const extractJobsFromCategoryPayload = (payload) =>
  Array.isArray(payload?.data?.Jobs) ? payload.data.Jobs : []

const mapJob = (job = {}) => {
  const title = normalizeWhitespace(job.JobTitle)
  const jobId = normalizeWhitespace(job.JobId)
  const requisitionId = normalizeWhitespace(job.JobCode) || jobId
  const applyUrl = normalizeWhitespace(job.ApplyUrl)

  if (!title || !jobId || !applyUrl || !isExpectedApplyUrl(applyUrl)) return null

  const { location, city, country } = extractPrimaryLocation(job)
  if (!isIndiaLikeAddress(location || '')) return null

  return {
    title,
    company: normalizeWhitespace(job.CompanyName) || COMPANY_NAME,
    department: normalizeWhitespace(job.Department),
    location,
    city,
    country: country || 'India',
    jobId,
    requisitionId,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: normalizeWhitespace(job.JobType),
    experienceRequired: buildExperienceRequired(job.Experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job.Skills)
      ? job.Skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizeWhitespace(job.PublishedDate),
    closingDate: normalizeWhitespace(job.PromotionExpiryDate),
    jobDescription: normalizeWhitespace(job.JobDescriptionV2 || job.JobDescription),
  }
}

export const extractSearchResults = (jobs = []) =>
  (Array.isArray(jobs) ? jobs : [])
    .map((job) => mapJob(job))
    .filter(Boolean)

const dedupeJobs = (jobs = []) => {
  const seen = new Set()
  const deduped = []

  for (const job of jobs) {
    const key = job.applyUrl || job.sourceUrl || job.jobId
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(job)
  }

  return deduped
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-text`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: OFFICIAL_CAREERS_URL,
    ...(options.headers ?? {}),
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
  ...options,
})

export const createKhatabookScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: rawFetchText = defaultFetchText,
    fetchJson: rawFetchJson = defaultFetchJson,
    signal,
  } = {}) {
    const fetchText = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const value = await rawFetchText(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const fetchJson = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const value = await rawFetchJson(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Khatabook verified official careers page no longer matches the verified public surface')
    }

    const careersScript = await fetchText(CAREERS_SCRIPT_URL)
    if (!hasOfficialJobsScriptSignal(careersScript)) {
      throw new Error('Khatabook verified hiring script no longer matches the verified public jobs contract')
    }

    const categories = extractCategoryIds(careersHtml)
    if (categories.length === 0) {
      throw new Error('Khatabook verified official careers page no longer exposes public opening categories')
    }

    const rawJobs = []
    for (const category of categories) {
      const url = buildCategoryJobsUrl(category)
      if (!url) continue
      const payload = await fetchJson(url)
      rawJobs.push(...extractJobsFromCategoryPayload(payload))
    }

    const jobs = dedupeJobs(extractSearchResults(rawJobs))
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = now()

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createKhatabookScraper().run(options)

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
