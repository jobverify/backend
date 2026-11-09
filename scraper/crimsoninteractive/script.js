import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'crimsoninteractive'
export const COMPANY = 'Crimson Interactive'
export const COUNTRY_FILTER = 'India'
export const OPPORTUNITIES_URL = 'https://www.crimsoni.com/opportunities.html'
export const LISTING_URL = 'https://crimsoniteam.freshteam.com/jobs'
export const DETAIL_URL_PATTERN = 'https://crimsoniteam.freshteam.com/jobs/{opaque_id}/{slug}'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const INDIA_LOCATION_HINT_PATTERN =
  /\b(?:india|mumbai|maharashtra|goregaon|airoli|vasai|gandhinagar|hyderabad|bangalore|bengaluru|pune|delhi|gurugram|noida|chennai)\b/i

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

const toAbsoluteUrl = (value, baseUrl = LISTING_URL) => {
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
  if (normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return COUNTRY_FILTER
  if (/remote|work from home/i.test(normalized)) return `Remote, ${COUNTRY_FILTER}`
  if (/,\s*india$/i.test(normalized)) return normalized
  return `${normalized}, ${COUNTRY_FILTER}`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /remote|work from home/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const inferRemoteStatus = (...values) => {
  const normalized = values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote') || normalized.includes('work from home') || normalized === 'true') {
    return 'Remote'
  }

  return 'On-site'
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/[â€™']/g, '') || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*years?\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

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

const extractDetailMetaParts = (html) => {
  const detailMeta = firstMatch(html, [
    /<div[^>]*class="[^"]*\bstick-hide-in-mobile\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ])

  const parts = String(detailMeta ?? '')
    .split('|')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length >= 2) {
    return {
      locationText: parts[0],
      employmentType: parts[1],
    }
  }

  return {
    locationText: detailMeta || null,
    employmentType: null,
  }
}

const isBrokenDetailDescription = (value) =>
  /liquid error:|undefined method\s+`public_fields'/i.test(String(value ?? ''))

const extractDescriptionHtml = (source) => {
  const html = String(source ?? '')
  const sectionMatch = html.match(
    /<div[^>]*class="[^"]*\bjob-details-content\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:Liquid error:|<\/div>|<\/body>)/i,
  )

  if (!sectionMatch?.[1]) return html

  return sectionMatch[1].replace(/Liquid error:[\s\S]*$/i, ' ')
}

export const isIndiaListing = (listing = {}) =>
  INDIA_LOCATION_HINT_PATTERN.test(normalizeWhitespace(listing.locationText) || '')

export const hasOfficialOpportunitiesSignal = (html) => {
  const rawHtml = String(html ?? '')
  const decoded = decodeHtmlEntities(rawHtml)

  return /Strengthen your career your way with Crimson Interactive/i.test(decoded)
    && /Our Openings are Available on/i.test(decoded)
    && /naukri\.com\/crimson-interactive-pvt-ltd-jobs/i.test(rawHtml)
    && /(?:angel\.co|wellfound\.com)\/company\/crimson-interactive-ai\/jobs/i.test(rawHtml)
    && /iimjobs\.com/i.test(rawHtml)
    && /joinus@crimsoni\.com/i.test(rawHtml)
    && /<!--\s*<a[^>]+href="https:\/\/crimsoniteam\.freshteam\.com\/jobs"/i.test(rawHtml)
}

export const hasOfficialJobsBoardSignal = (html) => {
  const rawHtml = String(html ?? '')
  const decoded = decodeHtmlEntities(rawHtml)
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /Crimson Interactive Inc/i.test(decoded)
    && /Join Us/i.test(normalized)
    && /Apply and become a Crimsonite yourself!/i.test(normalized)
    && /Open Positions/i.test(normalized)
    && /Choose Location/i.test(normalized)
    && /Remote jobs only/i.test(normalized)
    && /https:\/\/www\.crimsoni\.com\//i.test(rawHtml)
    && /\/jobs\/[^/"?#]+\/[^/"?#]+/i.test(rawHtml)
}

export const buildDetailUrl = (opaqueId, slug) =>
  DETAIL_URL_PATTERN
    .replace('{opaque_id}', opaqueId)
    .replace('{slug}', slug)

export const extractListingJobs = (html) => {
  const jobs = []
  const rolePattern = /<div[^>]*class="[^"]*\brole-title\b[^"]*"[^>]*>[\s\S]*?<h5[^>]*>\s*([^<]+?)\s*<span[\s\S]*?<\/span>\s*<\/h5>[\s\S]*?<div[^>]*class="[^"]*\bhidden-content\b[^"]*"[^>]*>[\s\S]*?<ul[^>]*class="[^"]*\bjob-list\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi

  for (const roleMatch of String(html ?? '').matchAll(rolePattern)) {
    const department = normalizeWhitespace(roleMatch[1])
    const roleJobsHtml = roleMatch[2]
    const listingPattern = /<li[^>]*class="[^"]*\bheading\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi

    for (const listingMatch of roleJobsHtml.matchAll(listingPattern)) {
      const listingBlock = listingMatch[1]
      const detailUrl = toAbsoluteUrl(firstMatch(listingBlock, [
        /<a[^>]+href="([^"]*\/jobs\/[^"/?#]+\/[^"/?#]+)"[^>]*class="[^"]*\bjob-title\b[^"]*"/i,
      ]))
      if (!detailUrl) continue

      const { opaqueId, slug } = extractDetailPathParts(detailUrl)
      const title = firstMatch(listingBlock, [
        /<a[^>]*class="[^"]*\bjob-title\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
      ])
      const summary = firstMatch(listingBlock, [
        /<a[^>]*class="[^"]*\bjob-desc\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
      ])
      const locationInfoMatch = listingBlock.match(
        /<a[^>]*class="[^"]*\blocation-info\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
      )
      const { locationText, employmentType } = extractLocationParts(locationInfoMatch?.[1] || '')

      jobs.push({
        title,
        summary,
        department,
        detailUrl,
        jobId: opaqueId,
        requisitionId: opaqueId,
        slug,
        locationText,
        employmentType,
        remoteFlag: null,
      })
    }
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
  const department = firstMatch(source, [
    /<a[^>]*class="[^"]*\blink-back\b[^"]*"[^>]*>[\s\S]*?<\/i>\s*([^<]+?)\s*<\/a>/i,
  ]) || listing.department || null
  const detailMeta = extractDetailMetaParts(source)
  const locationText = detailMeta.locationText || listing.locationText || null
  const detailDescription = normalizeWhitespace(extractDescriptionHtml(source))
  const jobDescription = !detailDescription || isBrokenDetailDescription(detailDescription)
    ? normalizeWhitespace(listing.summary)
    : detailDescription

  return {
    title,
    company: COMPANY,
    department,
    location: normalizeLocation(locationText),
    city: extractCity(locationText),
    country: COUNTRY_FILTER,
    jobId: listing.jobId || opaqueId || slug,
    requisitionId: listing.requisitionId || opaqueId || slug,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeEmploymentType(detailMeta.employmentType || listing.employmentType),
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

export const extractSearchResults = ({
  listingHtml = '',
  listingJobs = null,
  detailHtmlByUrl = {},
} = {}) => {
  const listings = Array.isArray(listingJobs) ? listingJobs : extractListingJobs(listingHtml)

  return listings.map((listing) =>
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

export const createCrimsonInteractiveScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())

    const opportunitiesHtml = await fetchText(OPPORTUNITIES_URL)
    if (!hasOfficialOpportunitiesSignal(opportunitiesHtml)) {
      throw new Error(
        'Crimson Interactive verified opportunities shell no longer matches the known first-party handoff surface',
      )
    }

    const listingHtml = await fetchText(LISTING_URL)
    if (!hasOfficialJobsBoardSignal(listingHtml)) {
      throw new Error(
        'Crimson Interactive verified public Freshteam board no longer matches the known public surface',
      )
    }

    const listingJobs = extractListingJobs(listingHtml).filter((listing) => isIndiaListing(listing))
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

export const run = async (options = {}) => createCrimsonInteractiveScraper().run(options)

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
