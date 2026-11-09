import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { HAPTIK_CATALOG } from './catalog.js'
import { createHaptikNativeInventory } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = HAPTIK_CATALOG.companyName
export const SOURCE = HAPTIK_CATALOG.source
export const COUNTRY_FILTER = HAPTIK_CATALOG.countryFilter
export const CAREERS_URL = HAPTIK_CATALOG.officialCareersPageUrl
export const LISTING_URL = HAPTIK_CATALOG.officialJobsBoardUrl
export const DETAIL_URL_PATTERN = HAPTIK_CATALOG.detailUrlPattern
export const VERIFIED_ON = HAPTIK_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = HAPTIK_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = HAPTIK_CATALOG

const INDIA_LOCATION_PATTERN =
  /\b(mumbai|bengaluru|bangalore|gurugram|gurgaon|hyderabad|chennai|pune|delhi|noida|india)\b/i

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

const normalizeFreshteamJobsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, CAREERS_URL)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
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

const extractCity = (value) => normalizeWhitespace(value)?.split(',')[0]?.trim() || null

const isIndiaLikeLocation = (value) => INDIA_LOCATION_PATTERN.test(normalizeWhitespace(value) || '')

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
  if (isIndiaLikeLocation(normalized)) return `${normalized}, ${COUNTRY_FILTER}`
  return normalized
}

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
  const normalized = normalizeWhitespace(value)?.replace(/[â€™']/g, '') || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\bat least\s+(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

const extractDescriptionHtml = (html) => {
  const match = String(html ?? '').match(
    /<p[^>]*>\s*Work Type:\s*[^<]+<\/p>([\s\S]*?)<h2[^>]*>\s*Submit Your Application\s*<\/h2>/i,
  )

  return String(match?.[1] || '').replace(/^\s*<h2[^>]*>[\s\S]*?<\/h2>\s*/i, '')
}

export const buildDetailUrl = (opaqueId, slug) =>
  DETAIL_URL_PATTERN
    .replace('{opaque_id}', opaqueId)
    .replace('{slug}', slug)

export const extractFreshteamJobsUrl = (html) =>
  normalizeFreshteamJobsUrl(firstMatch(html, [
    /<a[^>]+href="([^"]*freshteam\.com\/jobs[^"]*)"/i,
  ]))

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''
  return /Work at Haptik!/i.test(normalized)
    && /Explore All Open Positions/i.test(normalized)
    && extractFreshteamJobsUrl(html) === LISTING_URL
}

export const hasOfficialJobsBoardSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''
  return /\bHaptik Careers\b/i.test(normalized)
    && /\bOpen Positions\b/i.test(normalized)
    && /\/jobs\/[^/"?#]+\/[^/"?#]+/i.test(String(html ?? ''))
}

export const extractListingCards = (html) => {
  const listings = []

  for (const anchorMatch of String(html ?? '').matchAll(/<a[^>]+href="([^"]*\/jobs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const detailUrl = toAbsoluteUrl(anchorMatch[1], LISTING_URL)
    const spanValues = [...anchorMatch[2].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter(Boolean)
    const { opaqueId, slug } = extractJobPathParts(detailUrl)

    if (!detailUrl || !opaqueId || !slug || spanValues.length === 0) continue

    listings.push({
      title: spanValues[0],
      locationHint: spanValues[1] || null,
      employmentTypeHint: spanValues[2] || null,
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
    country: isIndiaLikeLocation(locationText) ? COUNTRY_FILTER : null,
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

export const createHaptikScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => createHaptikNativeInventory({ maxJobs: maxJobs ?? 0 })

export const run = async (options = {}) => createHaptikScraper().run(options)

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
