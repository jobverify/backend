import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DATADOG_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = DATADOG_CATALOG.source
export const COMPANY = DATADOG_CATALOG.companyName
export const PROVIDER_METADATA = DATADOG_CATALOG
export const CAREERS_URL = DATADOG_CATALOG.companyCareerPage
export const TYPESENSE_HOST = DATADOG_CATALOG.typesenseHost
export const TYPESENSE_COLLECTION = DATADOG_CATALOG.typesenseCollection
export const TYPESENSE_PUBLIC_KEY = DATADOG_CATALOG.typesensePublicKey
export const QUERY_BY = DATADOG_CATALOG.queryBy
export const FILTER_BY = DATADOG_CATALOG.filterBy
export const DEFAULT_JOBS_PER_PAGE = DATADOG_CATALOG.jobsPerPage

const CAREERS_ORIGIN = new URL(CAREERS_URL).origin

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (let index = 0; index < 2; index += 1) {
    decoded = decoded
      .replace(/&amp;/gi, '&')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
      .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
  }

  return decoded
}

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(li|p|div|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirstMatch = (value, pattern) => String(value ?? '').match(pattern)?.[1] ?? null

export const hasOfficialCareersSurface = (html = '') => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Job Openings\s*\|\s*Datadog Careers\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']We&#39;re building a platform that engineers love to use\. Join us, and help usher in the future\.["']/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/careers\.datadoghq\.com\/all-jobs\/["']/i.test(page)
    && /id=["']job-openings["']/i.test(page)
    && /search=["']true["']/i.test(page)
}

export const extractMainScriptUrl = (html = '') => {
  const relativeUrl = extractFirstMatch(
    html,
    /<script[^>]+src=["']([^"']*\/assets\/scripts\/main-[^"']+\.js)["'][^>]*>/i,
  )

  if (!relativeUrl) return null

  try {
    return new URL(relativeUrl, CAREERS_ORIGIN).toString()
  } catch {
    return null
  }
}

export const extractTypesenseConfig = (scriptText = '') => {
  const publicKey = extractFirstMatch(scriptText, /TYPESENSE_PUBLIC_KEY:"([^"]+)"/)
  const hostId = extractFirstMatch(scriptText, /TYPESENSE_HOST:"([^"]+)"/)
  const collection = extractFirstMatch(scriptText, /TYPESENSE_COLLECTION:"([^"]+)"/)
  const jobsPerPageValue = extractFirstMatch(scriptText, /jobs_per_page:(\d+)/)
  const jobsPerPage = jobsPerPageValue ? Number.parseInt(jobsPerPageValue, 10) : null

  if (!publicKey || !hostId || !collection || !Number.isInteger(jobsPerPage)) {
    return null
  }

  return {
    publicKey,
    host: `https://${hostId}.a1.typesense.net`,
    collection,
    jobsPerPage,
  }
}

export const hasOfficialMainBundleConfig = (scriptText = '') => {
  const config = extractTypesenseConfig(scriptText)

  return config?.publicKey === TYPESENSE_PUBLIC_KEY
    && config?.host === TYPESENSE_HOST
    && config?.collection === TYPESENSE_COLLECTION
    && config?.jobsPerPage === DEFAULT_JOBS_PER_PAGE
}

export const buildTypesenseSearchUrl = (page = 1, perPage = DEFAULT_JOBS_PER_PAGE) => {
  const url = new URL(
    `/collections/${encodeURIComponent(TYPESENSE_COLLECTION)}/documents/search`,
    TYPESENSE_HOST,
  )

  url.searchParams.set('q', '*')
  url.searchParams.set('query_by', QUERY_BY)
  url.searchParams.set('filter_by', FILTER_BY)
  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', String(perPage))

  return url.toString()
}

export const extractSearchSummary = (payload = {}) => {
  const found = Number.parseInt(String(payload?.found ?? ''), 10)
  const hits = Array.isArray(payload?.hits) ? payload.hits : null

  return {
    found: Number.isInteger(found) ? found : 0,
    hits,
  }
}

export const extractSearchDocuments = (payload = {}) => {
  const { hits } = extractSearchSummary(payload)

  if (!Array.isArray(hits)) {
    throw new Error('Datadog public Typesense search payload no longer exposes hits[]')
  }

  return hits
    .map((hit) => hit?.document)
    .filter((document) => document && typeof document === 'object')
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] ?? null

export const normalizeJob = (document = {}, { now = () => new Date().toISOString() } = {}) => {
  const jobId = normalizeWhitespace(document.job_id)
  const title = normalizeWhitespace(document.title)
  const location = normalizeWhitespace(document.location_string)
  const sourceUrl = normalizeWhitespace(document.absolute_url)

  if (!jobId || !title || !location || !sourceUrl) {
    return null
  }

  return {
    jobId,
    requisitionId: jobId,
    title,
    company: COMPANY,
    department: normalizeWhitespace(document.department) || normalizeWhitespace(document.team),
    location,
    city: extractCity(location),
    country: 'India',
    link: sourceUrl,
    applyUrl: sourceUrl,
    sourceUrl,
    source: SOURCE,
    employmentType: null,
    experienceRequired: null,
    jobDescription: stripHtml(document.description),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(document.last_mod),
    closingDate: null,
    scrapedAt: now(),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/javascript,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json, text/javascript, */*;q=0.8',
    'X-TYPESENSE-API-KEY': TYPESENSE_PUBLIC_KEY,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createDatadogScraper = ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  jobsPerPage = DEFAULT_JOBS_PER_PAGE,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSurface(careersHtml)) {
      throw new Error('Datadog official careers surface no longer matches the trusted first-party all-jobs page')
    }

    const mainScriptUrl = extractMainScriptUrl(careersHtml)
    if (!mainScriptUrl) {
      throw new Error('Datadog official careers page no longer exposes the trusted main bundle script')
    }

    const mainScript = await fetchText(mainScriptUrl)
    if (!hasOfficialMainBundleConfig(mainScript)) {
      throw new Error('Datadog official main bundle no longer exposes the verified public Typesense config')
    }

    const jobs = []
    const seenJobIds = new Set()
    let found = 0
    let page = 1
    let fetchedHits = 0

    while (page === 1 || fetchedHits < found) {
      const payload = await fetchJson(buildTypesenseSearchUrl(page, jobsPerPage))
      const summary = extractSearchSummary(payload)
      const documents = extractSearchDocuments(payload)

      if (page === 1) {
        found = summary.found
        if (found === 0) {
          throw new Error('Datadog public Typesense search no longer returns India roles from the official careers surface')
        }
      }

      if (documents.length === 0) {
        throw new Error('Datadog public Typesense search no longer returns documents for the verified India filter')
      }

      fetchedHits += documents.length

      for (const document of documents) {
        const normalized = normalizeJob(document, { now })
        if (!normalized || seenJobIds.has(normalized.jobId)) continue

        seenJobIds.add(normalized.jobId)
        jobs.push(normalized)
      }

      if (documents.length < jobsPerPage) break
      page += 1
    }

    if (jobs.length === 0) {
      throw new Error('Datadog public Typesense search no longer yields normalized India jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createDatadogScraper(options).run()

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
