import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { AISLE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = AISLE_CATALOG.companyName
export const SOURCE = AISLE_CATALOG.source
export const COUNTRY_FILTER = AISLE_CATALOG.countryFilter
export const OFFICIAL_HOMEPAGE_URL = AISLE_CATALOG.officialHomepageUrl
export const LISTING_URL = AISLE_CATALOG.officialJobsBoardUrl
export const DETAIL_URL_PATTERN = AISLE_CATALOG.detailUrlPattern
export const VERIFIED_ON = AISLE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AISLE_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AISLE_CATALOG

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
  const normalized = normalizeWhitespace(value)?.replace(/[’']/g, '') || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*years?\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(?:minimum\s+)?(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /Nothing casual about this dating app/i.test(normalized)
    && /\bMeet Our Crew\b/i.test(normalized)
    && /Want to join our team\?/i.test(normalized)
    && /\bCheck Openings\b/i.test(normalized)
    && /\bAisle Network Private Limited\b/i.test(normalized)
    && extractFreshteamJobsUrl(rawHtml) === LISTING_URL
}

export const extractFreshteamJobsUrl = (html) =>
  toAbsoluteUrl(firstMatch(html, [
    /<a[^>]+href="([^"]*freshteam\.com\/jobs[^"]*)"/i,
  ]), OFFICIAL_HOMEPAGE_URL)

export const hasEmptyJobsStateSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return /\bNo jobs found\b/i.test(normalized)
    && /\bTry refining your search\b/i.test(normalized)
    && /\bOpen Positions\b/i.test(normalized)
}

export const hasOfficialJobsBoardSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /\bAisle Careers\b/i.test(normalized)
    && /\bOpen Positions\b/i.test(normalized)
    && (
      hasEmptyJobsStateSignal(rawHtml)
      || /data-portal-id="job-role-list"/i.test(rawHtml)
      || /\/jobs\/[^/"?#]+\/[^/"?#]+/i.test(rawHtml)
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
    return html.slice(sectionStart)
  }

  return html
}

export const extractListingJobs = (html) => {
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

export const extractJobDetail = (html, listing = {}) => {
  const source = String(html ?? '')
  const detailUrl = listing.detailUrl || listing.sourceUrl || buildDetailUrl(listing.jobId, listing.slug)
  const { opaqueId, slug } = extractDetailPathParts(detailUrl)
  const title = firstMatch(source, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || listing.title
  const department = listing.department || firstMatch(source, [
    /<a[^>]*class="[^"]*\blink-back\b[^"]*"[^>]*>[\s\S]*?<\/i>\s*([^<]+?)\s*<\/a>/i,
  ])
  const locationText = firstMatch(source, [
    /<div[^>]*class="[^"]*\bstick-hide-in-mobile\b[^"]*"[^>]*>\s*([^<]+?)\s*<div>/i,
  ]) || listing.locationText
  const descriptionHtml = extractDescriptionHtml(source)
  const jobDescription = normalizeWhitespace(descriptionHtml) || normalizeWhitespace(listing.summary)

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
  const hasDetails = Object.keys(detailHtmlByUrl).length > 0
  const selectedListings = hasDetails
    ? listings.filter((listing) => detailHtmlByUrl[listing.detailUrl] != null)
    : listings

  return selectedListings.map((listing) =>
    extractJobDetail(detailHtmlByUrl[listing.detailUrl] || '', listing))
}

const isIndiaListing = (listing = {}) => {
  const location = normalizeWhitespace(listing.rawLocation || listing.locationText) || ''
  return /\bindia\b/i.test(location)
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 15000,
})

const markUpstreamOutage = (error) => {
  if (/\bHTTP\s+5\d\d\b/i.test(String(error?.message || error))) {
    error.softFailure = true
    error.upstreamOutage = true
  }

  return error
}

const fetchTextOrThrowUpstream = async (fetchText, url) => {
  try {
    return await fetchText(url)
  } catch (error) {
    throw markUpstreamOutage(error)
  }
}

export const isExpectedVerifiedBoardOutage = (error, url = LISTING_URL) =>
  new RegExp(`HTTP\\s+500\\b[\\s\\S]*${String(url).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    .test(String(error?.message ?? error ?? ''))

export const createAisleScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const signal = AbortSignal.any([AbortSignal.timeout(90000), ...(options.signal ? [options.signal] : [])])
    signal.throwIfAborted()
    const wait = promise => new Promise((resolve, reject) => {
      const finish = (fn, value) => { signal.removeEventListener('abort', abort); fn(value) }
      const abort = () => finish(reject, signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
      if (signal.aborted) abort()
    })
    let pagesFetched = 0
    const fetchText = async url => {
      signal.throwIfAborted(); pagesFetched++
      const value = await wait((options.fetchText || defaultFetchText)(url, { signal }))
      signal.throwIfAborted(); return value
    }
    const now = options.now || (() => new Date().toISOString())
    const gap = (jobs, reason) => attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: LISTING_URL,
      firstParty: true, listingComplete: false, reportedTotal: null, indiaFacetCount: null,
      pagesFetched, verifiedAt: now(), reason })
    const officialHtml = await fetchTextOrThrowUpstream(fetchText, OFFICIAL_HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(officialHtml)) {
      throw new Error('Aisle verified official homepage handoff no longer matches the trusted public surface')
    }

    const listingUrl = extractFreshteamJobsUrl(officialHtml)
    if (listingUrl !== LISTING_URL) {
      throw new Error('Verified official homepage handoff no longer points to the known Aisle Freshteam board')
    }

    let listingHtml
    try {
      listingHtml = await fetchTextOrThrowUpstream(fetchText, listingUrl)
    } catch (error) {
      if (listingUrl === LISTING_URL && isExpectedVerifiedBoardOutage(error, listingUrl)) {
        signal.throwIfAborted()
        return gap([], 'Current official homepage still declares this Freshteam board; HTTP 500 prevents observing its current native inventory, job countries or criteria; unknown totals')
      }

      throw error
    }

    if (!hasOfficialJobsBoardSignal(listingHtml)) {
      throw new Error('Aisle verified public Freshteam board no longer matches the known public surface')
    }

    if (hasEmptyJobsStateSignal(listingHtml)) {
      return gap([], 'Native HTML shows a no-jobs state; authoritative total, active filter defaults and closing inventory are not currently qualified')
    }

    const listingJobs = extractListingJobs(listingHtml).filter(isIndiaListing)
    const selectedListings = maxJobs ? listingJobs.slice(0, maxJobs) : listingJobs
    const detailHtmlByUrl = {}

    await Promise.all(selectedListings.map(async (listing) => {
      detailHtmlByUrl[listing.detailUrl] = await fetchTextOrThrowUpstream(fetchText, listing.detailUrl)
    }))

    const jobs = extractSearchResults({
      listingJobs: selectedListings,
      detailHtmlByUrl,
    })

    return gap(jobs.map((job) => ({
      ...job,
      requisitionId: null,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      sourceCountryEvidence: 'The same native listing explicitly includes India in its data-portal-location; city names and remote labels do not establish country.',
      sourceListingComplete: false,
      sourceDetailComplete: false,
      sourceDetailFailureKind: 'legacy-native-detail-and-current-inventory-not-qualified',
    })), 'Legacy role parsing remains outside verified current inventory: full same-identity native detail binding and closing inventory are not currently qualified')
  },
})

export const run = async (options = {}) => createAisleScraper().run(options)

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
