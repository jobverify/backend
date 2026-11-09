import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'newspaceresearchtechnologies'
export const COMPANY = 'New Space Research Technologies'
export const COUNTRY_FILTER = 'India'
export const HOMEPAGE_URL = 'https://newspace.co.in/'
export const LISTING_URL = 'https://newspace-talent.freshteam.com/jobs'
export const DETAIL_URL_PATTERN = 'https://newspace-talent.freshteam.com/jobs/{opaque_id}/{slug}'

const OFFICIAL_BOARD_BRAND = 'NewSpace Research & Technologies'
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
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalized,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)
  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const extractEmploymentTypeFromDetail = (html) =>
  firstMatch(html, [
    /Work Type:\s*([^<\n]+)/i,
  ])

const isBrokenDetailDescription = (value) =>
  /liquid error:|undefined method\s+`public_fields'/i.test(String(value ?? ''))

const extractDescriptionHtml = (source) => {
  const html = String(source ?? '')

  const betweenMarkers = html.match(
    /<a[^>]*>\s*Apply Now\s*<\/a>([\s\S]*?)(?:<h[1-6][^>]*>\s*Submit Your Application|<\/main>|<\/body>)/i,
  )
  if (betweenMarkers?.[1]) return betweenMarkers[1]

  const jobBody = html.match(
    /<section[^>]*class="[^"]*\bjob-body\b[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
  )
  if (jobBody?.[1]) return jobBody[1]

  return html
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const decoded = decodeHtmlEntities(rawHtml)
  const normalized = normalizeWhitespace(rawHtml)

  return /NewSpace Research and Technologies - Engineering tomorrow'?s missions, today/i
      .test(decoded)
    && /Engineering tomorrow's missions,\s*today/i.test(normalized)
    && /\bAbout Us\b/i.test(normalized)
    && /\bProducts\b/i.test(normalized)
    && /\bFounders\b/i.test(normalized)
    && /\bContact Us\b/i.test(normalized)
    && /info@newspace\.co\.in/i.test(rawHtml)
}

export const hasOfficialJobsBoardSignal = (html) => {
  const rawHtml = String(html ?? '')
  const decoded = decodeHtmlEntities(rawHtml)
  const hasCoreBoardSignal = /Careers/i.test(decoded)
    && /#\s*\d+\s*Jobs\b/i.test(decoded)
    && /Open Positions/i.test(decoded)
    && /\/jobs\/[^/"?#]+\/[^/"?#]+/i.test(rawHtml)
  const hasLegacyBrandSignal = /NewSpace Research\s*&\s*Technologies/i.test(decoded)
  const hasLiveBoardSignal = /newspace-talent\.freshteam\.com/i.test(rawHtml)
    && /data-portal-role/i.test(rawHtml)
    && /Who we are:/i.test(decoded)

  return hasCoreBoardSignal && (hasLegacyBrandSignal || hasLiveBoardSignal)
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

  const looksLikeEmploymentType = (input) =>
    /^(?:full(?:-|\s*)time|part(?:-|\s*)time|internship|contract)$/i.test(String(input ?? ''))

  if (parts.length === 1 && looksLikeEmploymentType(parts[0])) {
    return {
      locationText: null,
      employmentType: parts[0],
    }
  }

  if (parts.length >= 2 && looksLikeEmploymentType(parts[0]) && !looksLikeEmploymentType(parts[1])) {
    return {
      locationText: parts[1],
      employmentType: parts[0],
    }
  }

  return {
    locationText: parts[0] || null,
    employmentType: parts[1] || null,
  }
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
  const detailDescription = normalizeWhitespace(extractDescriptionHtml(source))
  const jobDescription = !detailDescription || isBrokenDetailDescription(detailDescription)
    ? normalizeWhitespace(listing.summary)
    : detailDescription
  const employmentType = normalizeEmploymentType(
    extractEmploymentTypeFromDetail(source) || listing.employmentType,
  )
  const locationText = normalizeWhitespace(listing.locationText)

  return {
    title,
    company: COMPANY,
    department: listing.department || null,
    location: normalizeLocation(locationText),
    city: extractCity(locationText),
    country: COUNTRY_FILTER,
    jobId: listing.jobId || opaqueId || slug,
    requisitionId: listing.requisitionId || opaqueId || slug,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType,
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(listing.remoteFlag, locationText, jobDescription),
    publicExperienceChecked: true,
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

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  ...options,
})

const isHomepageReachabilityError = (error) =>
  /connect timeout|timeout|timed out|could not connect|fetch failed|econnrefused|enotfound|ehostunreach/i.test(
    String(error?.message || error),
  )

export const createNewSpaceResearchTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())

    let homepageHtml = null

    try {
      homepageHtml = options.fetchText
        ? await fetchText(HOMEPAGE_URL)
        : await fetchText(HOMEPAGE_URL, { attempts: 1, timeoutMs: 10000 })
    } catch (error) {
      if (!isHomepageReachabilityError(error)) {
        throw error
      }
    }

    if (homepageHtml && !hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error(
        'New Space Research Technologies verified official homepage no longer matches the known public surface',
      )
    }

    const listingHtml = await fetchText(LISTING_URL)
    if (!hasOfficialJobsBoardSignal(listingHtml)) {
      throw new Error(
        'New Space Research Technologies verified public Freshteam board no longer matches the known public surface',
      )
    }

    const listingJobs = extractListingJobs(listingHtml)
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

export const run = async (options = {}) => createNewSpaceResearchTechnologiesScraper().run(options)

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
