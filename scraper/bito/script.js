import { createBitoNativeInventory } from './nativeInventory.js'
import CATALOG from './catalog.js'
export const PROVIDER_METADATA = CATALOG
// Archived July pure helpers below retain their historical fixture contract.
// Registered execution delegates to the current native inventory engine.

export const SOURCE = 'bito'
export const COMPANY = 'Bito'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_URL = 'https://bito.ai/careers/'
export const FRESHTEAM_JOBS_URL = 'https://bito.freshteam.com/jobs'
export const DETAIL_URL_PATTERN = 'https://bito.freshteam.com/jobs/{opaque_id}/{slug}'
export const EXPECTED_WIDGET_SCRIPT_PATTERN =
  /files\.freshteam\.com\/production\/98462\/attachments\/\d+\/original\/6000034511_widget\.js/i
export const EXPECTED_PUBLIC_JOB_PATH =
  '/jobs/Ot1OTp378jzF/account-executive-new-business-san-francisco-bay-area'
export const EXPECTED_PUBLIC_JOB_TITLE =
  'Account Executive, New Business (San Francisco Bay Area)'
export const EXPECTED_PUBLIC_JOB_DEPARTMENT = 'Sales'
export const EXPECTED_PUBLIC_JOB_VISIBLE_LOCATIONS =
  'San Francisco, United States of America | New York, United States of America'
export const EXPECTED_PUBLIC_JOB_WORK_TYPE = 'Full Time'
export const DISPOSITION =
  'verified-first-party-careers-page-plus-public-freshteam-jobs-board'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://bito.ai/careers/ was the live exact-name Bito careers page, that its open-roles section embedded the public Freshteam board at https://bito.freshteam.com/jobs, and that the board publicly exposed exactly one current opening: Account Executive, New Business (San Francisco Bay Area). The corresponding public Freshteam detail page visibly presented US preferred locations while hidden Freshteam list/schema metadata still referenced Pune, India, so this scraper validates that exact verified contract and extracts the public job conservatively from the visible detail page fields.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
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

const toAbsoluteUrl = (value, baseUrl = FRESHTEAM_JOBS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const buildDetailUrl = (opaqueId, slug) =>
  DETAIL_URL_PATTERN
    .replace('{opaque_id}', opaqueId)
    .replace('{slug}', slug)

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

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/[']/g, '') || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b[^.]{0,120}\bexperience\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b[^.]{0,120}\bexperience\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b[^.]{0,120}\bexperience\b/i)
  if (match) return `${match[1]} years`

  return null
}

const splitVisibleLocations = (value) =>
  (normalizeWhitespace(value) || '')
    .split(/\s*\|\s*/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

const normalizeCountryName = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^United States of America$/i.test(normalized)) return 'United States'
  return normalized
}

const extractCountryFromVisibleLocations = (value) => {
  const countries = [
    ...new Set(
      splitVisibleLocations(value)
        .map((location) => location.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean).at(-1))
        .map((country) => normalizeCountryName(country))
        .filter(Boolean),
    ),
  ]

  if (countries.length === 1) return countries[0]
  return countries[0] || null
}

const extractCityFromVisibleLocations = (value) => {
  const firstLocation = splitVisibleLocations(value)[0]
  if (!firstLocation) return null
  return firstLocation.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)[0] || null
}

const inferRemoteStatus = (jobPosting = {}, listing = {}) => {
  const remote = normalizeWhitespace(jobPosting?.remote)?.toLowerCase()
  if (remote === 'true') return 'Remote'

  const joined = [
    listing.locationText,
    listing.dataLocation,
    listing.remoteFlag,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (joined.includes('remote') || joined === 'true') return 'Remote'
  if (joined.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

const stripDescriptionHtml = (value = '') =>
  normalizeWhitespace(
    decodeHtmlEntities(value)
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*Careers at Bito\s*<\/title>/i.test(page)
    && /\bEnable developers to innovate at the speed of thought\b/i.test(text)
    && /\bBito is committed to AI tools that can revolutionize how software developers work\./i.test(
      text,
    )
    && /\bCurrently open positions\b/i.test(text)
    && /careers@bito\.ai/i.test(text)
    && /\bid=['"]freshteam-widget['"]/i.test(page)
}

export const extractFreshteamWidgetScriptUrls = (html = '', pageUrl = CAREERS_URL) => {
  const urls = []
  const matches = String(html ?? '').matchAll(
    /(?:src|data-rocket-src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''
    const absoluteUrl = toAbsoluteUrl(decodeHtmlEntities(rawValue), pageUrl)
    if (absoluteUrl) urls.push(absoluteUrl)
  }

  return [...new Set(urls)]
}

export const hasVerifiedFreshteamWidgetEmbed = (html = '') =>
  extractFreshteamWidgetScriptUrls(html)
    .some((url) => EXPECTED_WIDGET_SCRIPT_PATTERN.test(url))

export const hasFreshteamJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*Careers\s*<\/title>/i.test(page)
    && /\bOpen Positions\b/i.test(text)
    && /data-portal-id="job-role-list"/i.test(page)
    && /\/jobs\/[^/"?#]+\/[^/"?#]+/i.test(page)
}

export const extractListingJobs = (html = '') => {
  const jobs = []
  const rolePattern = /<li[^>]*data-portal-role="[^"]+"[^>]*>([\s\S]*?)<\/li>/gi

  for (const roleMatch of String(html ?? '').matchAll(rolePattern)) {
    const roleBlock = roleMatch[1]
    const department = firstMatch(roleBlock, [
      /<h5[^>]*>\s*([^<]+?)\s*(?:<span|<\/h5>)/i,
    ])

    const cardPattern = /<a[^>]+href="([^"]*\/jobs\/[^"/?#]+\/[^"/?#]+)"([^>]*)>([\s\S]*?)<\/a>/gi
    for (const cardMatch of roleBlock.matchAll(cardPattern)) {
      const detailUrl = toAbsoluteUrl(cardMatch[1], FRESHTEAM_JOBS_URL)
      if (!detailUrl) continue

      const attrs = cardMatch[2]
      const body = cardMatch[3]
      const { opaqueId, slug } = extractDetailPathParts(detailUrl)
      const locationInfo = body.match(
        /<div[^>]*class="[^"]*\blocation-info\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      )?.[1] || ''
      const title = firstMatch(body, [
        /<div[^>]*class="[^"]*\bjob-title\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ])
      const summary = firstMatch(body, [
        /<div[^>]*class="[^"]*\bjob-desc\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ])
      const locationParts = decodeHtmlEntities(locationInfo || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .split('\n')
        .map((part) => normalizeWhitespace(part))
        .filter(Boolean)

      jobs.push({
        title,
        summary,
        department,
        detailUrl,
        jobId: opaqueId,
        requisitionId: opaqueId,
        slug,
        locationText: locationParts[0] || null,
        employmentType: locationParts[1] || firstMatch(attrs, [
          /data-portal-job-type="([^"]+)"/i,
          /data-portal-job-type=([^\s>]+)/i,
        ]),
        dataLocation: firstMatch(attrs, [
          /data-portal-location="([^"]+)"/i,
        ]),
        remoteFlag: firstMatch(attrs, [
          /data-portal-remote-location="([^"]+)"/i,
          /data-portal-remote-location=([^\s>]+)/i,
        ]),
      })
    }
  }

  return jobs
}

export const extractVisiblePreferredLocations = (html = '') =>
  firstMatch(html, [
    /Preferable Location\(s\):\s*([\s\S]*?)\s*<div>\s*Work Type:/i,
  ])

export const extractJobPosting = (html = '') => {
  const rawJson = String(html ?? '').match(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/i,
  )?.[1]

  if (!rawJson) return null

  try {
    return JSON.parse(rawJson)
  } catch {
    return null
  }
}

export const extractJobDetail = (html = '', listing = {}) => {
  const detailUrl = listing.detailUrl || buildDetailUrl(listing.jobId, listing.slug)
  const { opaqueId, slug } = extractDetailPathParts(detailUrl)
  const title = firstMatch(html, [
    /<h1[^>]*class="[^"]*\bbrand-color\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || listing.title
  const visibleLocations = extractVisiblePreferredLocations(html)
  const visibleWorkType = firstMatch(html, [
    /Work Type:\s*([^<\n]+)/i,
  ])
  const jobPosting = extractJobPosting(html)
  const jobDescription = stripDescriptionHtml(jobPosting?.description || listing.summary)

  if (!title || title !== EXPECTED_PUBLIC_JOB_TITLE) {
    throw new Error('Bito verified public Freshteam detail page changed materially')
  }

  if (normalizeWhitespace(visibleLocations) !== EXPECTED_PUBLIC_JOB_VISIBLE_LOCATIONS) {
    throw new Error('Bito verified public Freshteam detail page changed materially')
  }

  if (normalizeWhitespace(visibleWorkType) !== EXPECTED_PUBLIC_JOB_WORK_TYPE) {
    throw new Error('Bito verified public Freshteam detail page changed materially')
  }

  if (!/<form[^>]+action="\/jobs\/Ot1OTp378jzF\/applicants"/i.test(String(html ?? ''))) {
    throw new Error('Bito verified public Freshteam apply surface changed materially')
  }

  if (normalizeWhitespace(jobPosting?.hiringOrganization?.name) !== COMPANY) {
    throw new Error('Bito verified public Freshteam JobPosting identity changed materially')
  }

  return {
    title,
    company: COMPANY,
    department: listing.department || EXPECTED_PUBLIC_JOB_DEPARTMENT,
    location: visibleLocations,
    city: extractCityFromVisibleLocations(visibleLocations),
    country: extractCountryFromVisibleLocations(visibleLocations),
    jobId: listing.jobId || opaqueId || slug,
    requisitionId: listing.requisitionId || opaqueId || slug,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeEmploymentType(visibleWorkType || listing.employmentType),
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizePostingDate(jobPosting?.datePosted),
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(jobPosting, listing),
  }
}

export const assertVerifiedListingContract = (listings = []) => {
  if (!Array.isArray(listings) || listings.length !== 1) {
    throw new Error('Bito verified public Freshteam listing contract changed materially')
  }

  const listing = listings[0]

  if (
    normalizeWhitespace(listing.title) !== EXPECTED_PUBLIC_JOB_TITLE
    || normalizeWhitespace(listing.department) !== EXPECTED_PUBLIC_JOB_DEPARTMENT
    || normalizeComparableUrl(listing.detailUrl)
      !== normalizeComparableUrl(buildDetailUrl('Ot1OTp378jzF', 'account-executive-new-business-san-francisco-bay-area'))
    || normalizeWhitespace(listing.locationText) !== 'Remote'
    || normalizeWhitespace(listing.employmentType) !== 'Full Time'
    || normalizeWhitespace(listing.dataLocation) !== 'Pune, India'
    || normalizeWhitespace(listing.remoteFlag)?.toLowerCase() !== 'true'
  ) {
    throw new Error('Bito verified public Freshteam listing contract changed materially')
  }
}

export const createBitoScraper = (options = {}) => createBitoNativeInventory(options)

export const run = async (options = {}) => createBitoScraper(options).run(options)
