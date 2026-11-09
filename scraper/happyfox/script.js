import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { HAPPYFOX_CATALOG } from './catalog.js'
import { createHappyFoxNativeInventory } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = HAPPYFOX_CATALOG.companyName
export const SOURCE = HAPPYFOX_CATALOG.source
export const COUNTRY_FILTER = HAPPYFOX_CATALOG.countryFilter
export const JOBS_HUB_URL = HAPPYFOX_CATALOG.officialJobsHubUrl
export const INDIA_CITY_PAGE_URLS = HAPPYFOX_CATALOG.indiaCityPageUrls
export const TRAKSTAR_JOBS_HOST = HAPPYFOX_CATALOG.legacyTrakstarJobsHost
export const HIRING_JOBS_HOST = 'https://hiring.happyfox.co'
export const VERIFIED_ON = HAPPYFOX_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = HAPPYFOX_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = HAPPYFOX_CATALOG

const INDIA_CITY_LABELS = INDIA_CITY_PAGE_URLS.map((value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/g, '')
    const slug = pathname.split('/').filter(Boolean).pop() || ''
    return titleCase(slug.replace(/-/g, ' '))
  } catch {
    return null
  }
}).filter(Boolean)

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
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|section)>/gi, ' ')
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

const parseJobPostingJsonLd = (html = '') => {
  const scripts = [...String(html).matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )]

  for (const [, payload] of scripts) {
    try {
      const data = JSON.parse(payload)
      const records = Array.isArray(data) ? data : [data]
      const jobPosting = records.find((record) => {
        const type = Array.isArray(record?.['@type']) ? record['@type'] : [record?.['@type']]
        return type.filter(Boolean).some((value) => /jobposting/i.test(String(value)))
      })

      if (jobPosting) return jobPosting
    } catch {
      continue
    }
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl = JOBS_HUB_URL) => {
  if (!value) return null

  try {
    const resolved = new URL(value, baseUrl)

    if (
      [TRAKSTAR_JOBS_HOST, HIRING_JOBS_HOST]
        .map((url) => new URL(url).hostname)
        .includes(resolved.hostname)
      && /^\/jobs\/[^/]+$/i.test(resolved.pathname.replace(/\/+$/g, ''))
    ) {
      resolved.protocol = 'https:'
      resolved.hash = ''
    }

    return resolved.toString()
  } catch {
    return null
  }
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const titleCase = (value) =>
  normalizeWhitespace(value)
    ?.toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase()) || null

const extractJobIdFromUrl = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '')
    const match = pathname.match(/\/jobs\/([^/]+)$/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

const extractCity = (value) => normalizeWhitespace(value)?.split(',')[0]?.trim() || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (!normalized) return null
  if (normalized.includes('full time') || normalized.includes('full-time')) return 'Full-time'
  if (normalized.includes('part time') || normalized.includes('part-time')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
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

  match = normalized.match(/\bminimum\s+(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

const extractDescriptionHtml = (html) => {
  const match = String(html ?? '').match(
    /<p[^>]*>\s*[^<]*\|\s*[^<]*\|\s*[^<]*<\/p>([\s\S]*?)<h2[^>]*>\s*Application Form\s*<\/h2>/i,
  )

  return match?.[1] || ''
}

const extractCurrentDescriptionHtml = (html) => {
  const match = String(html ?? '').match(
    /<div[^>]*class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<div[^>]*class=["'][^"']*job-actions/i,
  )
  return match?.[1] || ''
}

const extractCurrentJobMeta = (html) => {
  const container = String(html ?? '').match(
    /<div[^>]*class=["'][^"']*job-meta[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )?.[1] || ''
  return [...container.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const extractMetaContent = (html, key) => firstMatch(html, [
  new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i'),
  new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i'),
])

const extractLocationPart = (html, className) => firstMatch(html, [
  new RegExp(`<span[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`, 'i'),
])

const isTrackedCityPage = (value) => INDIA_CITY_PAGE_URLS.includes(value)

const isTrackedDetailUrl = (value) => {
  try {
    const url = new URL(value)
    const trackedHosts = [TRAKSTAR_JOBS_HOST, HIRING_JOBS_HOST]
      .map((host) => new URL(host).hostname)
    return trackedHosts.includes(url.hostname)
      && /^\/jobs\/[^/]+$/i.test(url.pathname.replace(/\/+$/g, ''))
  } catch {
    return false
  }
}

export const extractIndiaCityPageUrls = (html) => unique(
  [...String(html ?? '').matchAll(/<a[^>]+href="([^"]+)"/gi)]
    .map((match) => toAbsoluteUrl(match[1], JOBS_HUB_URL))
    .filter(isTrackedCityPage),
)

export const hasOfficialJobsHubSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return /Join Us In Spreading the Happy-ness/i.test(normalized)
    && /Open positions in India/i.test(normalized)
    && INDIA_CITY_LABELS.every((city) => new RegExp(`\\b${city}\\b`, 'i').test(normalized))
}

export const hasCityListingSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''
  return /Open Positions/i.test(normalized)
    && /Apply/i.test(normalized)
    && /hiring\.happyfox\.co\/jobs\//i.test(String(html ?? ''))
}

export const hasOfficialJobDetailSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''
  return /Careers at HappyFox/i.test(normalized)
    && /class=["'][^"']*job-title/i.test(String(html ?? ''))
    && /class=["'][^"']*job-meta/i.test(String(html ?? ''))
    && /class=["'][^"']*job-description/i.test(String(html ?? ''))
    && /class=["'][^"']*application-form/i.test(String(html ?? ''))
    && /href=["']https:\/\/www\.happyfox\.com(?:\/|["'])/i.test(String(html ?? ''))
    && /\bApply\b/i.test(normalized)
}

export const hasTrakstarJobSignal = hasOfficialJobDetailSignal

export const extractListingCards = (html, cityPageUrl) => {
  const listings = []
  const page = String(html ?? '')

  const sectionHeadings = [...page.matchAll(
    /<h2[^>]*class="[^"]*section-heading[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi,
  )]

  const getNearestSectionHeading = (index) => {
    let heading = null

    for (const match of sectionHeadings) {
      if ((match.index ?? -1) >= index) break
      heading = titleCase(match[1])
    }

    return heading
  }

  for (const cardMatch of page.matchAll(
    /<div class="hf-jobs__card"[\s\S]*?<h2[^>]*class="[^"]*hf-body__heading-mini[^"]*"[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<span[^>]*class="[^"]*hf-jobs__city[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*hf-jobs__type[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>\s*<span>\s*Apply\s*<\/span>/gi,
  )) {
    const title = normalizeWhitespace(cardMatch[1])
    const city = normalizeWhitespace(cardMatch[2])
    const employmentType = normalizeWhitespace(cardMatch[3])
    const detailUrl = toAbsoluteUrl(cardMatch[4], cityPageUrl)
    const department = getNearestSectionHeading(cardMatch.index ?? 0)

    if (!title || !city || !employmentType || !isTrackedDetailUrl(detailUrl)) continue

    const jobId = extractJobIdFromUrl(detailUrl)
    listings.push({
      title,
      department,
      locationHint: [city, employmentType].filter(Boolean).join(' | '),
      detailUrl,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      cityPageUrl,
      jobId,
      requisitionId: jobId,
    })
  }

  if (listings.length > 0) {
    return listings
  }

  for (const sectionMatch of page.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/gi)) {
    const sectionHtml = sectionMatch[1]
    const department = titleCase(firstMatch(sectionHtml, [
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
    ]))

    const cardPattern =
      /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<a[^>]+href="([^"]+)"[^>]*>\s*Apply\s*<\/a>/gi

    for (const cardMatch of sectionHtml.matchAll(cardPattern)) {
      const title = normalizeWhitespace(cardMatch[1])
      const locationHint = normalizeWhitespace(cardMatch[2])
      const detailUrl = toAbsoluteUrl(cardMatch[3], cityPageUrl)

      if (!title || !locationHint || !isTrackedDetailUrl(detailUrl)) continue

      const jobId = extractJobIdFromUrl(detailUrl)
      listings.push({
        title,
        department,
        locationHint,
        detailUrl,
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        cityPageUrl,
        jobId,
        requisitionId: jobId,
      })
    }
  }

  return listings
}

export const extractJobDetail = (html, listing = {}) => {
  const jobPosting = parseJobPostingJsonLd(html)
  const currentMeta = extractCurrentJobMeta(html)
  const listingMeta = String(listing.locationHint ?? '')
    .split('|')
    .map((part) => normalizeWhitespace(part))
  const title = firstMatch(html, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ])?.replace(/\s+at\s+HappyFox$/i, '') || normalizeWhitespace(jobPosting?.title) || extractMetaContent(html, 'og:title')?.replace(/\s+at\s+HappyFox$/i, '') || listing.title
  const summaryLine = firstMatch(html, [
    /<p[^>]*>\s*([^<]*\|\s*[^<]*\|\s*[^<]*)\s*<\/p>/i,
  ])
  const [legacyLocation, legacyDepartment, legacyEmploymentType] = String(summaryLine ?? '')
    .split('|')
    .map((part) => normalizeWhitespace(part))
  const detailUrl = listing.detailUrl || listing.sourceUrl || listing.applyUrl
  const jobId = listing.jobId || extractJobIdFromUrl(detailUrl)
  const jobDescription = normalizeWhitespace(
    extractCurrentDescriptionHtml(html)
    || extractDescriptionHtml(html)
    || jobPosting?.description
    || extractMetaContent(html, 'og:description'),
  )
  const city = extractLocationPart(html, 'meta-job-location-city')
    || normalizeWhitespace(jobPosting?.jobLocation?.address?.addressLocality)
    || extractCity(legacyLocation)
    || currentMeta[0]
    || extractCity(listingMeta[0])
  const state = extractLocationPart(html, 'meta-job-location-state')
    || normalizeWhitespace(jobPosting?.jobLocation?.address?.addressRegion)
  const country = extractLocationPart(html, 'meta-job-location-country')
    || normalizeWhitespace(jobPosting?.jobLocation?.address?.addressCountry)
    || COUNTRY_FILTER
  const location = legacyLocation || [city, state, country].filter(Boolean).join(', ') || null
  const employmentType = normalizeEmploymentType(
    legacyEmploymentType
    || normalizeWhitespace(jobPosting?.employmentType)?.replace(/_/g, '-')
    || listingMeta[1],
  )
  const experienceRequired = extractExperienceRequired(jobDescription)
  const hasPublicDetailEvidence = Boolean(
    title
    || location
    || jobDescription
    || employmentType
    || listing.department,
  )

  return {
    title,
    company: COMPANY_NAME,
    department: legacyDepartment || currentMeta[1] || listing.department || null,
    location,
    city: city || extractCity(location),
    country,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    publicExperienceChecked: hasPublicDetailEvidence && !experienceRequired,
    remoteStatus: inferRemoteStatus(currentMeta[2], location, jobDescription),
  }
}

export const createHappyFoxScraper = (options = {}) => createHappyFoxNativeInventory({ maxJobs: Number.isInteger(config.maxJobs) ? config.maxJobs : 0, ...options })

export const run = async (options = {}) => createHappyFoxScraper().run(options)

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
