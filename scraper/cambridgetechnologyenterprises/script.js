import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { CAMBRIDGE_TECHNOLOGY_ENTERPRISES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const OFFICIAL_HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_LANDING_URL = PROVIDER_METADATA.officialCareersLandingUrl
export const LISTING_URL = PROVIDER_METADATA.officialJobsBoardUrl
export const DETAIL_URL_PATTERN = PROVIDER_METADATA.detailUrlPattern
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const JOB_TYPE_MAP = {
  '1': 'Contract',
  '2': 'Full Time',
  '3': 'Internship',
}

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

const isVerifiedFreshteamJobsUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname === 'cambridgetechnology.freshteam.com'
      && /^\/jobs(?:\/search)?$/i.test(url.pathname)
  } catch {
    return false
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
  const normalized = normalizeWhitespace(value)?.replace(/['\u2019]/g, '') || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*years?\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(?:minimum\s+)?(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

export const extractFreshteamJobsUrl = (html) => {
  const matches = [...String(html ?? '').matchAll(
    /<a[^>]+href="([^"]*cambridgetechnology\.freshteam\.com\/jobs[^"]*)"/gi,
  )]
    .map((match) => toAbsoluteUrl(match[1], OFFICIAL_HOMEPAGE_URL))
    .filter(Boolean)

  return matches.find((url) => isVerifiedFreshteamJobsUrl(url))
    || matches[0]
    || null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''
  const directFreshteamHandoff = extractFreshteamJobsUrl(rawHtml)
  const hasKnownTitle = /<title>\s*(?:AI Cloud Solutions|Enterprise AI,\s*Data\s*&\s*SaaS Applications|Agentic AI Solutions for Enterprise(?: Workflows)?)\s*\|\s*Cambridge(?: Technology(?: Inc\.)?)?\s*<\/title>/i.test(rawHtml)
  const hasCareersRoute = /href="(?:https:\/\/www\.(?:ctepl|cambridgetech)\.com)?\/careers\/"/i.test(rawHtml)

  return hasKnownTitle
    && /\bCambridge Technology\b/i.test(normalized)
    && (hasCareersRoute || isVerifiedFreshteamJobsUrl(directFreshteamHandoff))
    && (/\bCareers\b/i.test(normalized) || isVerifiedFreshteamJobsUrl(directFreshteamHandoff))
}

export const hasOfficialCareersLandingSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Careers\s*-\s*Cambridge Technology Inc\.\s*<\/title>/i.test(rawHtml)
    && /\bCome,\s*Be a Part of the Future of Technology\b/i.test(normalized)
    && /\bStudents\/\s*Internships\b/i.test(normalized)
    && /\bFreshers\/\s*Graduates\b/i.test(normalized)
    && /\bExperienced Professionals INDIA\b/i.test(normalized)
    && /\bOpen Positions\b/i.test(normalized)
    && isVerifiedFreshteamJobsUrl(extractFreshteamJobsUrl(rawHtml))
}

export const hasOfficialJobsBoardSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /\bCareers\b/i.test(normalized)
    && /\bOpen Positions\b/i.test(normalized)
    && (
      /data-portal-id="job-role-list"/i.test(rawHtml)
      || /\/jobs\/[^/"?#]+\/[^/"?#]+/i.test(rawHtml)
      || /\bChoose Location\b/i.test(normalized)
      || /\bNo jobs found\b/i.test(normalized)
    )
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

const extractDescriptionHtml = (source) => {
  const html = String(source ?? '')
  const sectionStart = html.search(/<div[^>]*class="[^"]*\bjob-details-content\b[^"]*"[^>]*>/i)
  if (sectionStart >= 0) {
    const openingEnd = html.indexOf('>', sectionStart) + 1
    const tags = /<div\b[^>]*>|<\/div\s*>/gi
    tags.lastIndex = openingEnd
    let depth = 1
    for (let match; (match = tags.exec(html));) {
      depth += /^<\//.test(match[0]) ? -1 : 1
      if (depth === 0) {
        const content = html.slice(openingEnd, match.index)
        const formStart = content.search(/<div\b[^>]*(?:class=["'][^"']*\bapplication-form\b|id=["']applicant-form)/i)
        return formStart >= 0 ? content.slice(0, formStart) : content
      }
    }
    throw new Error('Cambridge detail description is incomplete')
  }

  return null
}

const extractLegacyListingJobs = (html) => {
  const jobs = []
  const rolePattern = /<li[^>]*data-portal-role="[^"]+"[^>]*>([\s\S]*?)<\/li>/gi

  for (const roleMatch of String(html ?? '').matchAll(rolePattern)) {
    const roleBlock = roleMatch[1]
    const department = firstMatch(roleBlock, [
      /<h5[^>]*>\s*([^<]+?)\s*(?:<span|<\/h5>)/i,
    ])

    const cardPattern = /<a[^>]+href="([^"]*\/jobs\/[^"/?#]+\/[^"/?#]+)"([^>]*)>([\s\S]*?)<\/a>/gi
    for (const cardMatch of roleBlock.matchAll(cardPattern)) {
      const detailUrl = toAbsoluteUrl(cardMatch[1])
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
        department,
        detailUrl,
        jobId: opaqueId,
        requisitionId: opaqueId,
        slug,
        locationText: locationText || dataLocation || null,
        employmentType: employmentType || JOB_TYPE_MAP[dataJobType] || null,
        remoteFlag,
        rawLocation: dataLocation || locationText || null,
      })
    }
  }

  return jobs
}

const extractAnchors = (html) => [...String(html ?? '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  .map((match) => ({
    href: match[1].match(/\bhref=["']([^"']+)["']/i)?.[1],
    classes: (match[1].match(/\bclass=["']([^"']*)["']/i)?.[1] || '').split(/\s+/),
    rel: (match[1].match(/\brel=["']([^"']*)["']/i)?.[1] || '').split(/\s+/),
    html: match[2],
  }))

const extractReportedTotal = (html) => {
  const totals = []
  for (const [tag] of String(html ?? '').matchAll(/<meta\b[^>]*>/gi)) {
    const name = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1]
    if (!/^(?:og|twitter):description$/i.test(name || '')) continue
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]
    const count = content?.match(/^\s*#(\d+)\s+Jobs?\b/i)
    if (count) totals.push(Number(count[1]))
  }
  // The older grouped template publishes a separate count for every department.
  const groups = [...String(html ?? '').matchAll(/<li[^>]*data-portal-role=["'][^"']+["'][^>]*>([\s\S]*?)<\/li>/gi)]
  const groupCounts = groups.map(group => group[1].match(/<h5\b[^>]*>[\s\S]*?\b(\d+)\s+Open Roles?\b/i)?.[1])
  if (groups.length && groupCounts.every(count => count != null)) {
    totals.push(groupCounts.reduce((sum, count) => sum + Number(count), 0))
  }
  if (totals.some(total => !Number.isSafeInteger(total) || total !== totals[0])) {
    throw new Error('Cambridge listing is incomplete: reported vacancy totals disagree')
  }
  return totals[0] ?? null
}

const extractNextPageUrl = (html, currentUrl) => {
  const currentPage = Number(new URL(currentUrl).searchParams.get('page') || 1)
  const candidates = new Set()
  let hasLaterPage = false
  for (const anchor of extractAnchors(html)) {
    if (!anchor.href) continue
    const url = toAbsoluteUrl(decodeHtmlEntities(anchor.href), currentUrl)
    const explicitNext = anchor.rel.includes('next') || anchor.classes.includes('next')
      || /^Next(?:\s+Page)?\s*[›»→]?$/i.test(normalizeWhitespace(anchor.html) || '')
    let numberedNext = false
    if (url && isVerifiedFreshteamJobsUrl(url)) {
      const page = Number(new URL(url).searchParams.get('page'))
      numberedNext = page === currentPage + 1
      if (page > currentPage + 1 && !explicitNext) {
        hasLaterPage = true
        continue
      }
    }
    if (!explicitNext && !numberedNext) continue
    if (!isVerifiedFreshteamJobsUrl(url) || new URL(url).protocol !== 'https:') {
      throw new Error('Cambridge pagination contains an untrusted first-party listing URL')
    }
    candidates.add(url)
  }
  if (hasLaterPage && candidates.size === 0) throw new Error('Cambridge listing is incomplete: pagination skipped the adjacent page')
  if (candidates.size > 1) throw new Error('Cambridge listing is incomplete: ambiguous next pagination page')
  return [...candidates][0] || null
}

export const extractListingJobs = (html) => {
  const anchors = extractAnchors(html)
  const expectedUrls = new Set()
  for (const anchor of anchors) {
    const detailUrl = toAbsoluteUrl(anchor.href)
    if (!detailUrl || !extractDetailPathParts(detailUrl).opaqueId) continue
    const url = new URL(detailUrl)
    if (url.protocol !== 'https:' || url.hostname !== new URL(LISTING_URL).hostname) {
      throw new Error('Cambridge listing contains an untrusted first-party detail URL')
    }
    expectedUrls.add(detailUrl)
  }
  let jobs
  if (anchors.some((anchor) => anchor.classes.includes('job-title'))) {
    jobs = []
    for (const row of String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const rowAnchors = extractAnchors(row[1])
      const titleAnchor = rowAnchors.find((anchor) => anchor.classes.includes('job-title'))
      if (!titleAnchor) continue
      const detailUrl = toAbsoluteUrl(titleAnchor.href)
      const { opaqueId, slug } = extractDetailPathParts(detailUrl)
      const locationAnchor = rowAnchors.find((anchor) => anchor.classes.includes('location-info'))
      const { locationText, employmentType } = extractLocationParts(locationAnchor?.html || '')
      jobs.push({
        title: normalizeWhitespace(titleAnchor.html),
        summary: normalizeWhitespace(rowAnchors.find((anchor) => anchor.classes.includes('job-desc'))?.html),
        department: null, detailUrl, jobId: opaqueId, requisitionId: opaqueId, slug,
        locationText, rawLocation: locationText, employmentType, remoteFlag: null,
      })
    }
  } else {
    jobs = extractLegacyListingJobs(html)
  }
  const parsedUrls = new Set(jobs.map((job) => job.detailUrl))
  if (parsedUrls.size !== jobs.length || parsedUrls.size !== expectedUrls.size
    || [...expectedUrls].some((url) => !parsedUrls.has(url))
    || jobs.some((job) => !job.title || !job.jobId || !job.locationText)) {
    throw new Error('Cambridge listing is incomplete: not every public vacancy was parsed')
  }
  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const source = String(html ?? '')
  const detailUrl =
    listing.detailUrl
    || listing.sourceUrl
    || buildDetailUrl(listing.jobId, listing.slug)
  const { opaqueId, slug } = extractDetailPathParts(detailUrl)
  const title = firstMatch(source, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ])
  if (!title) throw new Error('Cambridge detail page is incomplete: missing role title')
  if (source.trim() && listing.title && title !== normalizeWhitespace(listing.title)) {
    throw new Error('Cambridge detail identity does not match its listing')
  }
  const department = listing.department || firstMatch(source, [
    /<a[^>]*class="[^"]*\blink-back\b[^"]*"[^>]*>[\s\S]*?<\/i>\s*([^<]+?)\s*<\/a>/i,
  ])
  const locationText = firstMatch(source, [
    /<div[^>]*class="[^"]*\bstick-hide-in-mobile\b[^"]*"[^>]*>\s*([^<]+?)\s*<div>/i,
    /<div[^>]*class="[^"]*\bstick-hide-in-mobile\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ])?.split('|')[0]?.trim() || listing.locationText
  const descriptionHtml = extractDescriptionHtml(source)
  const jobDescription = normalizeWhitespace(descriptionHtml)
  if (!jobDescription) throw new Error('Cambridge detail description is incomplete or empty')

  return {
    title,
    company: COMPANY_NAME,
    department,
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

export const extractSearchResults = ({
  listingHtml = '',
  listingJobs = null,
  detailHtmlByUrl = {},
} = {}) => {
  const listings = Array.isArray(listingJobs) ? listingJobs : extractListingJobs(listingHtml)
  return listings.map((listing) => {
    if (detailHtmlByUrl[listing.detailUrl] == null) {
      throw new Error('Cambridge detail inventory is incomplete: a listed vacancy has no detail response')
    }
    return extractJobDetail(detailHtmlByUrl[listing.detailUrl], listing)
  })
}

const isIndiaListing = (listing = {}) => {
  const location = normalizeWhitespace(listing.rawLocation || listing.locationText) || ''
  return /\bindia\b/i.test(location)
    || /\b(?:hyderabad|bengaluru|bangalore|pune|mumbai|gurugram|gurgaon|chennai|noida|delhi)\b/i.test(location)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCambridgeTechnologyEnterprisesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) && config.maxPages > 0 ? config.maxPages : 100,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())
    const officialHtml = await fetchText(OFFICIAL_HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(officialHtml)) {
      throw new Error(
        'Cambridge Technology Enterprises verified official homepage handoff no longer matches the trusted public surface',
      )
    }

    let listingUrl = null
    const directListingUrl = extractFreshteamJobsUrl(officialHtml)
    if (isVerifiedFreshteamJobsUrl(directListingUrl)) {
      listingUrl = LISTING_URL
    } else {
      const careersLandingHtml = await fetchText(CAREERS_LANDING_URL)
      if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
        throw new Error(
          'Cambridge Technology Enterprises verified first-party careers landing no longer matches the trusted public surface',
        )
      }

      const landingListingUrl = extractFreshteamJobsUrl(careersLandingHtml)
      if (!isVerifiedFreshteamJobsUrl(landingListingUrl)) {
        throw new Error(
          'Verified first-party careers landing no longer points to the known Cambridge Technology Freshteam board',
        )
      }

      listingUrl = LISTING_URL
    }

    const allListings = []
    const seenPages = new Set()
    const seenJobs = new Set()
    let nextUrl = listingUrl
    let reportedTotal = null
    let explicitEmpty = false
    while (nextUrl) {
      if (seenPages.has(nextUrl) || seenPages.size >= maxPages) {
        throw new Error('Cambridge listing is incomplete: repeated pagination page or page limit reached')
      }
      const listingHtml = await fetchText(nextUrl)
      seenPages.add(nextUrl)
      if (!hasOfficialJobsBoardSignal(listingHtml)) {
        throw new Error('Cambridge Technology Enterprises verified public Freshteam board no longer matches the known public surface')
      }
      const pageTotal = extractReportedTotal(listingHtml)
      if (pageTotal != null && reportedTotal != null && pageTotal !== reportedTotal) {
        throw new Error('Cambridge listing is incomplete: reported total changed during pagination')
      }
      reportedTotal ??= pageTotal
      const pageListings = extractListingJobs(listingHtml)
      const pageEmpty = /\bNo jobs found\b/i.test(normalizeWhitespace(listingHtml) || '')
      if (pageListings.length === 0 && !pageEmpty) {
        throw new Error('Cambridge listing is incomplete: no verified vacancy or explicit empty state')
      }
      if (pageEmpty && (pageListings.length > 0 || allListings.length > 0 || reportedTotal > 0)) {
        throw new Error('Cambridge listing is incomplete: explicit empty state contradicts the vacancy total')
      }
      explicitEmpty ||= pageEmpty
      for (const listing of pageListings) {
        if (seenJobs.has(listing.jobId)) throw new Error('Cambridge listing is incomplete: repeated vacancy across pagination pages')
        seenJobs.add(listing.jobId)
        allListings.push(listing)
      }
      nextUrl = extractNextPageUrl(listingHtml, nextUrl)
      if (pageEmpty && nextUrl) throw new Error('Cambridge listing is incomplete: empty state contains more pagination')
    }
    if (explicitEmpty) reportedTotal ??= 0
    if (reportedTotal != null && allListings.length !== reportedTotal) {
      throw new Error('Cambridge listing is incomplete: parsed vacancy count does not match the reported total')
    }
    if (allListings.some((listing) => !isIndiaListing(listing) && /\bremote\b/i.test(listing.locationText || ''))) {
      throw new Error('Cambridge listing location scope is incomplete for remote vacancies')
    }
    const listingJobs = allListings.filter(isIndiaListing)
    const capped = Number.isInteger(maxJobs) && maxJobs > 0
    const selectedListings = capped ? listingJobs.slice(0, maxJobs) : listingJobs
    const detailHtmlByUrl = {}

    await Promise.all(selectedListings.map(async (listing) => {
      const detailHtml = await fetchText(listing.detailUrl)
      if (!/<h1\b/i.test(detailHtml) || !/\bjob-details-content\b/i.test(detailHtml)) {
        throw new Error('Cambridge detail page is incomplete or does not match the verified role shell')
      }
      detailHtmlByUrl[listing.detailUrl] = detailHtml
    }))

    const jobs = extractSearchResults({
      listingJobs: selectedListings,
      detailHtmlByUrl,
    })

    const listingComplete = reportedTotal != null && !capped
    const verifiedAt = now()
    return attachInventoryEvidence(jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: verifiedAt,
      ...(!listingComplete ? { sourceListingComplete: false } : {}),
    })), {
      status: !listingComplete ? 'discovery-only' : explicitEmpty ? 'verified-empty' : 'complete-inventory',
      surface: listingUrl,
      firstParty: true,
      listingComplete,
      pagesFetched: seenPages.size,
      reportedTotal,
      indiaFacetCount: listingJobs.length,
      verifiedAt,
      reason: capped ? 'freshteam-max-jobs-cap' : !listingComplete ? 'freshteam-reported-total-unavailable'
        : explicitEmpty ? 'verified-freshteam-explicit-empty' : 'complete-freshteam-public-inventory',
    })
  },
})

export const run = async (options = {}) => createCambridgeTechnologyEnterprisesScraper().run(options)

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
