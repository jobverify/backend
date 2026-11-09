import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { SATTVA_MEDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = SATTVA_MEDIA_CATALOG.source
export const COMPANY_NAME = SATTVA_MEDIA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SATTVA_MEDIA_CATALOG.officialBrandName
export const LEGAL_ENTITY_NAME = SATTVA_MEDIA_CATALOG.legalEntityName
export const COUNTRY_FILTER = SATTVA_MEDIA_CATALOG.countryFilter
export const JOIN_US_URL = SATTVA_MEDIA_CATALOG.homepageUrl
export const CAREERS_URL = SATTVA_MEDIA_CATALOG.officialCareersPageUrl
export const LISTING_URL = SATTVA_MEDIA_CATALOG.officialJobsBoardUrl
export const DETAIL_URL_PATTERN = SATTVA_MEDIA_CATALOG.detailUrlPattern
export const VERIFIED_ON = SATTVA_MEDIA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SATTVA_MEDIA_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = SATTVA_MEDIA_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN =
  /\b(india|new delhi|delhi|gurgaon|gurugram|bangalore|bengaluru|mumbai|pune|hyderabad|chennai|noida)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|a|span)>/gi, ' ')
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

const toAbsoluteUrl = (value, baseUrl = LISTING_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractJobPathParts = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '')
    const match = pathname.match(/\/jobs\/([^/]+)\/([^/]+)$/i)
    return {
      opaqueId: match?.[1] || null,
      slug: match?.[2] || null,
    }
  } catch {
    return {
      opaqueId: null,
      slug: null,
    }
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (!normalized) return null
  if (normalized.includes('full time') || normalized.includes('full-time')) return 'Full-time'
  if (normalized.includes('part time') || normalized.includes('part-time')) return 'Part-time'
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/remote|work from home/i.test(normalized)) return `Remote, ${COUNTRY_FILTER}`
  if (/,\s*india$/i.test(normalized)) return normalized
  if (INDIA_LOCATION_PATTERN.test(normalized)) return `${normalized}, ${COUNTRY_FILTER}`
  return normalized
}

const extractCity = (value) => normalizeWhitespace(value)?.split(',')[0]?.trim() || null

const inferRemoteStatus = (...values) => {
  const normalized = values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote') || normalized.includes('work from home')) return 'Remote'
  return 'On-site'
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/[Ã¢â‚¬â„¢']/g, '') || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

const extractDescriptionHtml = (html) => {
  const match = String(html ?? '').match(
    /<p[^>]*>\s*Work Type:\s*[^<]+<\/p>([\s\S]*?)<h2[^>]*>\s*Submit Your Application\s*<\/h2>/i,
  )

  return String(match?.[1] || '')
}

export const hasBlockedFirstPartyAccessSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''
  return /Attention Required!\s*\|\s*Cloudflare/i.test(normalized)
    && /please enable cookies/i.test(normalized)
    && /you are unable to access/i.test(normalized)
    && /cloudflare/i.test(normalized)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const buildDetailUrl = (opaqueId, slug) =>
  DETAIL_URL_PATTERN
    .replace('{opaque_id}', opaqueId)
    .replace('{slug}', slug)

export const extractFreshteamJobsUrl = (html) =>
  toAbsoluteUrl(firstMatch(html, [
    /<a[^>]+href="([^"]*freshteam\.com\/jobs[^"]*)"/i,
  ]), CAREERS_URL)

export const hasOfficialJoinUsLandingSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''
  return /Join Sattva/i.test(normalized)
    && /\bLife at Sattva\b/i.test(normalized)
    && /\bCareers\b/i.test(normalized)
    && /careers@sattva\.co\.in/i.test(normalized)
    && /Learn about our new opportunities and apply for positions online/i.test(normalized)
}

export const hasOfficialCareersPageSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''
  return /Careers - Sattva Consulting/i.test(normalized)
    && /Interested in being one of us\?/i.test(normalized)
    && /\bSEE ALL JOBS\b/i.test(normalized)
    && /careers@sattva\.co\.in/i.test(normalized)
}

export const hasOfficialJobsBoardSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''
  return /\bCareers\b/i.test(normalized)
    && /\bOpen Positions\b/i.test(normalized)
    && /\/jobs\/[^/"?#]+\/[^/"?#]+/i.test(String(html ?? ''))
}

export const extractListingCards = (html) => {
  const listings = []

  for (const anchorMatch of String(html ?? '').matchAll(/<a[^>]+href="([^"]*\/jobs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const detailUrl = toAbsoluteUrl(anchorMatch[1], LISTING_URL)
    const anchorHtml = String(anchorMatch[2] ?? '')
    const spanValues = [...anchorHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter(Boolean)
    const title = firstMatch(anchorHtml, [
      /<div[^>]+class="job-title"[^>]*>([\s\S]*?)<\/div>/i,
    ]) || spanValues[0]
    const locationLines = String(anchorHtml.match(/<div[^>]+class="location-info"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .split(/\r?\n/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean)
    const { opaqueId, slug } = extractJobPathParts(detailUrl)

    if (!detailUrl || !opaqueId || !slug || !title) continue

    listings.push({
      title,
      locationHint: locationLines[0] || spanValues[1] || null,
      employmentTypeHint: locationLines[1] || spanValues[2] || null,
      detailUrl,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      jobId: opaqueId,
      requisitionId: opaqueId,
      slug,
    })
  }

  return listings
}

export const extractJobDetail = (html, listing = {}) => {
  const detailUrl = listing.detailUrl || buildDetailUrl(listing.jobId, listing.slug)
  const { opaqueId, slug } = extractJobPathParts(detailUrl)
  const title = firstMatch(html, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || listing.title
  const department = firstMatch(html, [
    /<h4[^>]*>([\s\S]*?)<\/h4>/i,
  ])
  const locationText = firstMatch(html, [
    /<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
  ]) || listing.locationHint
  const employmentType = firstMatch(html, [
    /Work Type:\s*([^<\n]+)/i,
  ]) || listing.employmentTypeHint
  const jobDescription = normalizeWhitespace(extractDescriptionHtml(html))

  return {
    title,
    company: COMPANY_NAME,
    department,
    location: normalizeLocation(locationText),
    city: extractCity(locationText),
    country: INDIA_LOCATION_PATTERN.test(normalizeWhitespace(locationText) || '') ? COUNTRY_FILTER : null,
    jobId: listing.jobId || opaqueId || slug,
    requisitionId: listing.requisitionId || opaqueId || slug,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeEmploymentType(employmentType),
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(title, locationText, jobDescription),
  }
}

const isIndiaLikeLocation = (value) => INDIA_LOCATION_PATTERN.test(normalizeWhitespace(value) || '')

export const createSattvaMediaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())
    const joinUsHtml = await fetchText(JOIN_US_URL)
    const joinUsBlocked = hasBlockedFirstPartyAccessSignal(joinUsHtml)

    if (!hasOfficialJoinUsLandingSignal(joinUsHtml) && !joinUsBlocked) {
      throw new Error('The verified Sattva join-us landing page no longer matches the trusted public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const careersBlocked = hasBlockedFirstPartyAccessSignal(careersHtml)

    if (!hasOfficialCareersPageSignal(careersHtml) && !careersBlocked) {
      throw new Error('The verified Sattva careers page no longer matches the trusted public surface')
    }

    const listingUrl = hasOfficialCareersPageSignal(careersHtml)
      ? (extractFreshteamJobsUrl(careersHtml) || LISTING_URL)
      : LISTING_URL
    if (listingUrl !== LISTING_URL) {
      throw new Error('The verified Sattva careers page no longer points to the expected Freshteam board')
    }

    const listingHtml = await fetchText(listingUrl)
    if (!hasOfficialJobsBoardSignal(listingHtml)) {
      throw new Error('The verified Sattva Freshteam board no longer matches the trusted public surface')
    }

    const indiaListings = extractListingCards(listingHtml)
      .filter((listing) => isIndiaLikeLocation(listing.locationHint))
    const selectedListings = Number.isInteger(maxJobs) ? indiaListings.slice(0, maxJobs) : indiaListings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.detailUrl)
      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        source: SOURCE,
        link: listing.detailUrl,
        scrapedAt: now(),
      })
    }

    return jobs.filter((job) => job.country === COUNTRY_FILTER)
  },
})

export const run = async (options = {}) => createSattvaMediaScraper().run(options)

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
