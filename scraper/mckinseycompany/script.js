import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MCKINSEY_COMPANY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MCKINSEY_COMPANY_CATALOG.source
export const COMPANY = MCKINSEY_COMPANY_CATALOG.companyName
export const VERIFIED_ON = MCKINSEY_COMPANY_CATALOG.verifiedOn
export const HOMEPAGE_URL = MCKINSEY_COMPANY_CATALOG.homepageUrl
export const INDIA_CAREERS_URL = MCKINSEY_COMPANY_CATALOG.companyCareerPage
export const SEARCH_JOBS_URL = MCKINSEY_COMPANY_CATALOG.publicJobsSearchUrl
export const SEARCH_API_BASE_URL = MCKINSEY_COMPANY_CATALOG.publicSearchApiUrl
export const SEARCH_PAGE_SIZE = MCKINSEY_COMPANY_CATALOG.searchPageSize
export const VERIFIED_SURFACE_SUMMARY = MCKINSEY_COMPANY_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = MCKINSEY_COMPANY_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const normalizeValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const normalizeDate = (value) => {
  const normalized = normalizeValue(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toArray = (value) => Array.isArray(value) ? value : []

export const buildSearchApiUrl = ({
  start = 1,
  pageSize = SEARCH_PAGE_SIZE,
  lang = 'en',
} = {}) => `${SEARCH_API_BASE_URL}?pageSize=${pageSize}&start=${start}&lang=${lang}`

export const hasOfficialIndiaCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Careers in India\s*\|\s*India\s*\|\s*McKinsey\s*&amp;\s*Company\s*<\/title>/i.test(page)
    && text.includes('search jobs')
    && text.includes('careers in india')
    && text.includes('join mckinsey india')
    && text.includes('find your ideal job')
    && text.includes('career paths for students')
}

export const hasPublicJobsSearchSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*McKinsey Job Search\s*\|\s*Consulting and Internal Roles\s*\|\s*Careers\s*\|\s*McKinsey\s*&amp;\s*Company\s*<\/title>/i.test(page)
    && page.includes('/careers/search-jobs/en')
    && page.includes('gateway.mckinsey.com')
    && page.includes('__NEXT_DATA__')
}

export const extractIndiaCityPairs = (record = {}) => {
  const cities = toArray(record.cities)
  const countries = toArray(record.countries)
  const pairs = []

  for (let index = 0; index < Math.min(cities.length, countries.length); index += 1) {
    const city = normalizeValue(cities[index])
    const country = normalizeValue(countries[index])
    if (!city || !country) continue
    if (country.toLowerCase() !== 'india') continue
    pairs.push({ city, country })
  }

  return pairs
}

const isIndiaJob = (record = {}) => extractIndiaCityPairs(record).length > 0

const buildLocation = (pairs = []) => pairs
  .map(({ city, country }) => `${city}, ${country}`)
  .join(' | ')

const toJob = (record = {}, { now = () => new Date().toISOString() } = {}) => {
  const indiaPairs = extractIndiaCityPairs(record)
  const applyUrl = normalizeValue(record.jobApplyURL)
  const jobId = normalizeValue(record.jobID)

  return {
    title: normalizeValue(record.title),
    company: COMPANY,
    department: normalizeValue(record.interest),
    location: buildLocation(indiaPairs),
    city: indiaPairs.length > 1 ? 'Multiple Locations' : (indiaPairs[0]?.city ?? null),
    jobId,
    requisitionId: jobId,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record.postedToLinkedInDate),
    closingDate: null,
    jobDescription: normalizeValue(record.shortJobSummary),
    source: SOURCE,
    link: applyUrl,
    scrapedAt: now(),
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createMckinseyCompanyScraper = ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(override = {}) {
    const { signal } = override
    const rawFetchText = override.fetchText || fetchText
    const rawFetchJson = override.fetchJson || fetchJson
    const effectiveFetchText = async (url, options = {}) => {
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
    const effectiveFetchJson = async (url, options = {}) => {
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

    const indiaCareersHtml = await effectiveFetchText(INDIA_CAREERS_URL)
    if (!hasOfficialIndiaCareersSignal(indiaCareersHtml)) {
      throw new Error('McKinsey & Company verified India careers page no longer matches the first-party handoff')
    }

    const searchJobsHtml = await effectiveFetchText(SEARCH_JOBS_URL)
    if (!hasPublicJobsSearchSignal(searchJobsHtml)) {
      throw new Error('McKinsey & Company verified public search jobs page no longer matches the first-party shell')
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let start = 1; ; start += SEARCH_PAGE_SIZE) {
      const payload = await effectiveFetchJson(buildSearchApiUrl({ start }))
      const docs = toArray(payload?.docs)

      if (docs.length === 0) {
        break
      }

      for (const record of docs) {
        if (!isIndiaJob(record)) continue

        const job = toJob(record, { now })
        if (!job.title || !job.jobId || !job.applyUrl) continue
        if (seenJobIds.has(job.jobId)) continue

        seenJobIds.add(job.jobId)
        jobs.push(job)
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createMckinseyCompanyScraper(options).run(options)

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
