import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { GEEKYANTS_SOFTWARE_CATALOG as PROVIDER_METADATA } from './catalog.js'
import { readNativeGeekyantsCareers } from './nativeCareers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export { PROVIDER_METADATA }
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const TOPGEEK_COMPANY_SLUG = PROVIDER_METADATA.topgeekCompanySlug

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const firstMatch = (source, patterns) => {
  for (const pattern of patterns) {
    const match = String(source ?? '').match(pattern)
    const value = normalizeWhitespace(match?.[1])
    if (value) return value
  }

  return null
}

const extractJobIdFromUrl = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '')
    return pathname.split('/').pop() || null
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return COUNTRY_FILTER
  if (/,\s*india$/i.test(normalized)) return normalized
  return `${normalized}, ${COUNTRY_FILTER}`
}

const extractCity = (value) => normalizeWhitespace(value)?.split(',')[0]?.trim() || null

const inferRemoteStatus = (...values) => {
  const normalized = values.map((value) => normalizeWhitespace(value)).filter(Boolean).join(' ').toLowerCase()
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote') || normalized.includes('work from home')) return 'Remote'
  return 'On-site'
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value) || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*years?\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*years?\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*years?\b/i)
  if (match) return `${match[1]} years`

  return null
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  includeResponseMetadata: true,
  signal,
})

const pageBody = (response, requestedUrl, allowText) => {
  if (allowText && typeof response === 'string') return response
  const requested = new URL(requestedUrl)
  let finalUrl
  try { finalUrl = new URL(response?.url) } catch { /* Missing metadata is unresolved. */ }
  if (response?.status !== 200 || typeof response?.html !== 'string' || !finalUrl
    || finalUrl.username || finalUrl.password || finalUrl.origin !== requested.origin
    || finalUrl.pathname.replace(/\/+$/, '') !== requested.pathname.replace(/\/+$/, '')
    || finalUrl.search !== requested.search || finalUrl.hash) {
    throw new Error('GeekyAnts response did not preserve the verified source URL and HTTP status')
  }
  return response.html
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''
  const listings = extractListingJobs(html)

  return /Join GeekyAnts/i.test(normalized)
    && listings.length >= 2
    && new RegExp(`topgeek\\.io/company/${TOPGEEK_COMPANY_SLUG}/openings`, 'i').test(String(html ?? ''))
}

export const extractListingJobs = (html = '') => {
  const jobs = []
  const anchorPattern = new RegExp(
    `<a[^>]+href=["'](https://topgeek\\.io/company/${TOPGEEK_COMPANY_SLUG}/openings/[^"']+)["'][^>]*>([\\s\\S]*?)</a>`,
    'gi',
  )

  for (const match of String(html ?? '').matchAll(anchorPattern)) {
    const detailUrl = match[1]
    const body = match[2]
    const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)

    jobs.push({
      title: firstMatch(body, [
        /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i,
      ]),
      detailUrl,
      jobId: extractJobIdFromUrl(detailUrl),
      requisitionId: extractJobIdFromUrl(detailUrl),
      locationText: paragraphs[0] || null,
      summary: paragraphs[1] || null,
      department: null,
    })
  }

  return jobs
}

export const extractJobDetail = (html = '', listing = {}) => {
  const title = firstMatch(html, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || listing.title
  const locationText = firstMatch(html, [
    /Location<\/div>\s*<div[^>]*>([^<]+)</i,
    /Location<\/p>\s*<p[^>]*>([^<]+)</i,
  ]) || listing.locationText
  const experienceRequired = extractExperienceRequired(firstMatch(html, [
    /Experience<\/div>\s*<div[^>]*>([^<]+)</i,
    /Experience<\/p>\s*<p[^>]*>([^<]+)</i,
  ]))
  const descriptionSection = String(html ?? '').match(/Job Description<\/h[1-6]>([\s\S]*?)<\/body>/i)
  const jobDescription = normalizeWhitespace(descriptionSection?.[1]) || normalizeWhitespace(listing.summary)

  return {
    title,
    company: COMPANY_NAME,
    department: listing.department || null,
    location: normalizeLocation(locationText),
    city: extractCity(locationText),
    country: COUNTRY_FILTER,
    jobId: listing.jobId,
    requisitionId: listing.requisitionId,
    sourceUrl: listing.detailUrl,
    applyUrl: listing.detailUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(locationText, jobDescription),
  }
}

const isIndiaListing = (listing = {}) => {
  const location = normalizeWhitespace(listing.locationText) || ''
  return /india|bengaluru|bangalore|mumbai|pune|hyderabad|chennai|gurugram|gurgaon|noida|delhi/i.test(location)
}

export const createGeekyantsSoftwareScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchPage || options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())
    const signal = options.signal
    const loadPage = async url => {
      signal?.throwIfAborted()
      const response = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return pageBody(response, url, fetchText !== defaultFetchText)
    }
    const limit = Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? maxJobs : null

    const careersHtml = await loadPage(OFFICIAL_CAREERS_URL)
    const native = readNativeGeekyantsCareers(careersHtml)
    if (native) {
      let pagesFetched = 1
      const reasons = [...native.issues]
      let stable = false
      try {
        const closingHtml = await loadPage(OFFICIAL_CAREERS_URL)
        pagesFetched += 1
        const closing = readNativeGeekyantsCareers(closingHtml)
        stable = closing?.complete === true && closing.signature === native.signature
        if (!stable) reasons.push('native-closing-inventory-not-reconciled')
      } catch (error) {
        signal?.throwIfAborted()
        reasons.push(`native-closing-inventory-unavailable:${error.message}`)
      }
      const capped = limit != null && native.jobs.length > limit
      if (capped) reasons.push('native-output-capped')
      const complete = native.complete && stable && !capped
      const jobs = (limit == null ? native.jobs : native.jobs.slice(0, limit)).map(job => ({
        ...job, scrapedAt: now(), sourceListingComplete: complete, lifecycleCleanupAllowed: complete,
      }))
      return attachInventoryEvidence(jobs, {
        status: complete ? 'complete-inventory' : 'coverage-gap', surface: OFFICIAL_CAREERS_URL,
        firstParty: true, listingComplete: complete, pagesFetched, reportedTotal: native.reportedTotal,
        indiaFacetCount: complete ? native.jobs.length : null, verifiedAt: now(),
        reason: complete ? 'native-card-jobposting-count-and-closing-inventory-reconciled' : reasons.join(';'),
      })
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Geekyants Software verified first-party careers page no longer matches the trusted public surface')
    }

    const listings = extractListingJobs(careersHtml).filter(isIndiaListing)
    const selectedListings = limit == null ? listings : listings.slice(0, limit)
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await loadPage(listing.detailUrl)
      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        source: SOURCE,
        link: listing.detailUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createGeekyantsSoftwareScraper().run(options)

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
