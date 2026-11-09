import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { PLUTO7_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = PLUTO7_CATALOG.companyName
export const SOURCE = PLUTO7_CATALOG.source
export const COUNTRY_FILTER = PLUTO7_CATALOG.countryFilter
export const CAREERS_URL = PLUTO7_CATALOG.officialCareersPageUrl
export const OPENINGS_URL = PLUTO7_CATALOG.companyCareerPage
export const WIDGET_SCRIPT_URL = PLUTO7_CATALOG.freshteamWidgetScriptUrl
export const JOBS_BOARD_URL = PLUTO7_CATALOG.officialJobsBoardUrl
export const LISTING_URL = PLUTO7_CATALOG.listingSearchUrl
export const DETAIL_URL_PATTERN = PLUTO7_CATALOG.detailUrlPattern
export const VERIFIED_ON = PLUTO7_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PLUTO7_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = PLUTO7_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const JOB_TYPE_MAP = {
  '1': 'Contract',
  '2': 'Full Time',
  '3': 'Internship',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
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

const toAbsoluteUrl = (value, baseUrl = JOBS_BOARD_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractDetailPathParts = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '')
    const match = pathname.match(/\/jobs\/([^/]+)\/([^/]+)$/i)
    if (!match) return { opaqueId: null, slug: null }

    return {
      opaqueId: match[1],
      slug: match[2],
    }
  } catch {
    return { opaqueId: null, slug: null }
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

const isIndiaLikeLocation = (value) => /india|bengaluru|bangalore|mumbai|pune|gurugram|gurgaon|hyderabad|chennai|delhi|noida/i
  .test(normalizeWhitespace(value) || '')

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return COUNTRY_FILTER
  if (/remote|work from home/i.test(normalized)) return `Remote, ${COUNTRY_FILTER}`
  if (/,\s*india$/i.test(normalized)) return normalized
  if (isIndiaLikeLocation(normalized)) return `${normalized}, ${COUNTRY_FILTER}`
  return normalized
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /remote|work from home/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const inferRemoteStatus = (...values) => {
  const normalizedValues = values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
  const joined = normalizedValues.join(' ').toLowerCase()

  if (normalizedValues.some((value) => /^true$/i.test(value))) return 'Remote'
  if (joined.includes('hybrid')) return 'Hybrid'
  if (joined.includes('remote') || joined.includes('work from home')) return 'Remote'
  return 'On-site'
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/[â€™']/g, '') || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return /JOIN OUR TEAM OF SPECIALISTS AND BRING CHANGE TO THE WORLD!/i.test(normalized)
    && /Unleash yourself and perform at your peak staying out of the box/i.test(normalized)
    && /Open Positions/i.test(normalized)
}

export const extractWidgetScriptUrl = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["'](https:\/\/s3\.amazonaws\.com\/files\.freshteam\.com\/production\/30755\/attachments\/2000860557\/original\/2000015632_widget\.js\?1579600329)["'][^>]*>/i,
  )

  if (!match) return null

  try {
    return new URL(match[1]).toString()
  } catch {
    return null
  }
}

export const hasCareerOpeningsSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /Find the next big job in your career!/i.test(normalized)
    && /freshteam-widget/i.test(rawHtml)
    && extractWidgetScriptUrl(rawHtml) === WIDGET_SCRIPT_URL
}

export const extractFreshteamCompanyUrl = (html) => {
  const match = String(html ?? '').match(
    /JobWidget\([^,]+,\s*['"](https:\/\/pluto7\.freshteam\.com)['"]\)/i,
  )

  if (!match) return null

  try {
    return new URL(match[1]).toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export const buildListingUrl = (companyUrl) => {
  if (!companyUrl) return null

  try {
    return new URL('/jobs/search', companyUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialJobsBoardSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /\bCareers\s*-\s*Pluto7\b/i.test(rawHtml)
    && /\bOpen Positions\b/i.test(normalized)
    && /\/jobs\/[^/"?#]+\/[^/"?#]+/i.test(rawHtml)
}

export const buildDetailUrl = (opaqueId, slug) =>
  DETAIL_URL_PATTERN
    .replace('{opaque_id}', opaqueId)
    .replace('{slug}', slug)

const extractLocationParts = (value) => {
  const parts = decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return {
    locationText: parts[0] || null,
    employmentType: parts[1] || null,
  }
}

const extractDescriptionHtml = (html) => {
  const match = String(html ?? '').match(
    /<div[^>]*class="[^"]*\bjob-details-content\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<a/i,
  )

  if (match?.[1]) return match[1]

  const fallback = String(html ?? '').match(
    /<div[^>]*class="[^"]*\bjob-details-content\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  )

  return fallback?.[1] || ''
}

export const extractListingJobs = (html) => {
  const jobs = []

  for (const cardMatch of String(html ?? '').matchAll(/<a[^>]+href="([^"]*\/jobs\/[^"/?#]+\/[^"/?#]+)"([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const detailUrl = toAbsoluteUrl(cardMatch[1], JOBS_BOARD_URL)
    if (!detailUrl) continue

    const attrs = cardMatch[2]
    const body = cardMatch[3]
    const { opaqueId, slug } = extractDetailPathParts(detailUrl)
    const remoteFlag = firstMatch(attrs, [
      /data-portal-remote-location="([^"]+)"/i,
      /data-portal-remote-location=([^\s>]+)/i,
    ])
    const dataLocation = firstMatch(attrs, [
      /data-portal-location="([^"]*)"/i,
    ])
    const dataJobType = firstMatch(attrs, [
      /data-portal-job-type="([^"]+)"/i,
      /data-portal-job-type=([^\s>]+)/i,
    ])
    const summary = firstMatch(body, [
      /<div[^>]*class="[^"]*\bjob-desc\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ])
    const title = firstMatch(body, [
      /<div[^>]*class="[^"]*\bjob-title\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ])
    const locationInfoMatch = body.match(
      /<div[^>]*class="[^"]*\blocation-info\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    )
    const { locationText, employmentType } = extractLocationParts(locationInfoMatch?.[1] || '')

    jobs.push({
      title,
      summary,
      detailUrl,
      jobId: opaqueId,
      requisitionId: opaqueId,
      slug,
      locationText: locationText || dataLocation || null,
      employmentType: employmentType || JOB_TYPE_MAP[dataJobType] || null,
      remoteFlag,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const source = String(html ?? '')
  const detailUrl = listing.detailUrl || listing.sourceUrl || buildDetailUrl(listing.jobId, listing.slug)
  const { opaqueId, slug } = extractDetailPathParts(detailUrl)
  const title = firstMatch(source, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || listing.title
  const locationText = firstMatch(source, [
    /<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
  ]) || listing.locationText
  const jobDescription = normalizeWhitespace(extractDescriptionHtml(source)) || normalizeWhitespace(listing.summary)

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location: normalizeLocation(locationText),
    city: extractCity(locationText),
    country: COUNTRY_FILTER,
    jobId: listing.jobId || opaqueId || slug,
    requisitionId: listing.requisitionId || opaqueId || slug,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeEmploymentType(firstMatch(source, [
      /Work Type:\s*([^<\n]+)/i,
    ]) || listing.employmentType),
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(listing.remoteFlag, locationText, jobDescription),
  }
}

const isIndiaListing = (listing = {}) => isIndiaLikeLocation(listing.locationText)

export const extractSearchResults = ({
  listingHtml = '',
  listingJobs = null,
  detailHtmlByUrl = {},
} = {}) => {
  const listings = (Array.isArray(listingJobs) ? listingJobs : extractListingJobs(listingHtml))
    .filter(isIndiaListing)
  const hasDetails = Object.keys(detailHtmlByUrl).length > 0
  const selectedListings = hasDetails
    ? listings.filter((listing) => detailHtmlByUrl[listing.detailUrl] != null)
    : listings

  return selectedListings.map((listing) =>
    extractJobDetail(detailHtmlByUrl[listing.detailUrl] || '', listing))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPluto7Scraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Pluto7 careers page no longer matches the trusted public surface')
    }

    const openingsHtml = await fetchText(OPENINGS_URL)
    if (!hasCareerOpeningsSignal(openingsHtml)) {
      throw new Error('The verified Pluto7 career openings page no longer matches the trusted public surface')
    }

    const widgetScriptUrl = extractWidgetScriptUrl(openingsHtml)
    if (widgetScriptUrl !== WIDGET_SCRIPT_URL) {
      throw new Error('The verified Pluto7 career openings page no longer matches the trusted public surface')
    }

    const widgetScriptHtml = await fetchText(widgetScriptUrl)
    const companyUrl = extractFreshteamCompanyUrl(widgetScriptHtml)
    if (!companyUrl || buildListingUrl(companyUrl) !== LISTING_URL) {
      throw new Error('The verified Pluto7 Freshteam widget no longer points to the expected public tenant')
    }

    const listingHtml = await fetchText(LISTING_URL)
    if (!hasOfficialJobsBoardSignal(listingHtml)) {
      throw new Error('The verified Pluto7 Freshteam search page no longer matches the trusted public surface')
    }

    const listingJobs = extractListingJobs(listingHtml).filter(isIndiaListing)
    const selectedListings = maxJobs ? listingJobs.slice(0, maxJobs) : listingJobs
    const detailHtmlByUrl = {}

    await Promise.all(selectedListings.map(async (listing) => {
      detailHtmlByUrl[listing.detailUrl] = await fetchText(listing.detailUrl)
    }))

    const jobs = extractSearchResults({
      listingJobs: selectedListings,
      detailHtmlByUrl,
    })

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createPluto7Scraper().run(options)

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
