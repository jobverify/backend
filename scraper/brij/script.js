import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'brij'
export const COMPANY = 'Brij'
export const VERIFIED_ON = '2026-08-01'
export const CAREERS_URL = 'https://brij.ai/careers'
export const BOARD_URL = 'https://brij.applytojob.com/apply'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const BOARD_HOST = new URL(BOARD_URL).hostname
const APPLY_PATH_PREFIX = '/apply'
const INDIA_LOCATION_PATTERN =
  /\b(?:india|remote,\s*india|bangalore|bengaluru|hyderabad|chennai|mumbai|pune|gurugram|gurgaon|noida|delhi|kolkata|ahmedabad)\b/i
const UNITED_STATES_LOCATION_PATTERN =
  /\b(?:united states|new york city|new york|ny|austin|texas|tx)\b/i

const decodeEntities = (value = '') =>
  String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value = '') =>
  decodeEntities(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const stripToLines = (value = '') =>
  decodeEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|section|article|ul|ol|h[1-6]|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const toAbsoluteBoardUrl = (value, baseUrl = BOARD_URL) => {
  try {
    const url = new URL(value, baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== BOARD_HOST) return null
    if (!url.pathname.startsWith(APPLY_PATH_PREFIX)) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

const extractJobId = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    const applyIndex = segments.indexOf('apply')
    return applyIndex >= 0 ? segments[applyIndex + 1] || null : null
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const extractEmploymentType = (value = '') =>
  normalizeEmploymentType(
    String(value ?? '').match(/\b(full[\s-]*time|part[\s-]*time|contract|internship)\b/i)?.[1]
      || null,
  )

const inferCountryFromLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (INDIA_LOCATION_PATTERN.test(normalized)) return 'India'
  if (UNITED_STATES_LOCATION_PATTERN.test(normalized)) return 'United States'
  return null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalizeWhitespace(normalized.split(',')[0]) || null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  const title = extractTitle(page) || ''
  const legacySignal = /\bWork with us\b/i.test(text)
    && /\bfuture of digital product experiences\b/i.test(text)
    && /\bApply Now\b/i.test(text)
  const currentSignal = /^Brij Careers\s*\|\s*Open Roles in NYC & Remote$/i.test(title)
    && /\bBrij Careers\b/i.test(text)
    && /\bBuild the Future of Product Experience\b/i.test(text)

  return /^Brij Careers\b/i.test(title) && (legacySignal || currentSignal)
}

export const extractOfficialApplyUrls = (html = '') => {
  const urls = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = toAbsoluteBoardUrl(match[1], CAREERS_URL)
    if (!url) continue
    if (seen.has(url)) continue

    seen.add(url)
    urls.push(url)
  }

  return urls
}

export const hasVerifiedBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return extractTitle(page) === 'Brij - Career Page'
    && /\bCurrent Openings\b/i.test(text)
    && /\bView Our Website\b/i.test(text)
    && (
      /\bPowered by JazzHR\b/i.test(text)
      || /Please review our open positions and apply to the positions that match your qualifications\.?/i.test(text)
    )
}

export const hasInactiveBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  return extractTitle(page) === 'JazzHR - Inactive Career Page'
    && /\bThis account is no longer active\.?\b/i.test(text)
    && /\bLearn more about JazzHR\.?\b/i.test(text)
    && /https:\/\/info\.jazzhr\.com\/job-seekers\.html/i.test(page)
}

export const extractBoardJobs = (html = '') => {
  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<h3[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>([\s\S]*?)(?=<h3\b|<\/li>|$)/gi,
  )) {
    const applyUrl = toAbsoluteBoardUrl(match[1])
    const title = normalizeWhitespace(match[2])
    const lines = stripToLines(match[3])
    const location = normalizeWhitespace(lines[0])
    const jobId = applyUrl ? extractJobId(applyUrl) : null

    if (!applyUrl || !title || !location || !jobId || seen.has(applyUrl)) continue

    seen.add(applyUrl)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCity(location),
      country: inferCountryFromLocation(location),
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    })
  }

  return jobs
}

export const hasVerifiedJobDetailSignal = (html = '', listing = {}) => {
  const text = normalizeText(html)
  const title = normalizeWhitespace(listing?.title)
  const pageTitle = extractTitle(html)

  return /\bBrij\b/i.test(text)
    && /\bApply for this position\b/i.test(text)
    && (
      /\bPowered by JazzHR\b/i.test(text)
      || /\bCareer Page\b/i.test(pageTitle || '')
      || /Please review our open positions and apply to the positions that match your qualifications\.?/i.test(text)
    )
    && (!title || new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text))
}

export const extractJobDetail = (html = '', listing = {}) => {
  if (!hasVerifiedJobDetailSignal(html, listing)) {
    throw new Error(`The verified Brij job detail no longer matches the trusted public surface: ${listing?.sourceUrl || 'unknown job'}`)
  }

  const lines = stripToLines(html)
  const employmentType = normalizeEmploymentType(
    lines.find((line) => /\b(full[\s-]*time|part[\s-]*time|contract|internship)\b/i.test(line))
      || null,
  )
  const experienceRequired =
    normalizeWhitespace(
      lines.find((line) => /\bexperienced\b/i.test(line))
        || normalizeText(html).match(/\b([0-9]+(?:\+)?\s*years?)\b/i)?.[1]
        || null,
    )
    || null
  const jobDescriptionCandidates = lines.filter((line) =>
    !new RegExp(`^${normalizeWhitespace(listing.title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(line)
    && line !== normalizeWhitespace(listing.location)
    && !/\b(full[\s-]*time|part[\s-]*time|contract|internship)\b/i.test(line)
    && !/\bexperienced\b/i.test(line)
    && !/\bApply for this position\b/i.test(line)
    && !/\bPowered by JazzHR\b/i.test(line)
    && !/\bCareer Page\b/i.test(line)
    && !/\bOpen to WFH\/Remote OR Hybrid NYC\b/i.test(line)
  )
  const jobDescription = normalizeWhitespace(jobDescriptionCandidates.join(' ')) || null

  return {
    company: COMPANY,
    location: listing.location,
    city: listing.city,
    country: inferCountryFromLocation(listing.location) || listing.country,
    employmentType,
    experienceRequired,
    jobDescription,
  }
}

const isIndiaRole = (job = {}) => {
  const location = normalizeWhitespace(job.location)
  const country = normalizeWhitespace(job.country)

  return country === 'India' || INDIA_LOCATION_PATTERN.test(location || '')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const mergeListingWithDetail = (listing, detail = {}) => ({
  ...listing,
  ...Object.fromEntries(
    Object.entries(detail).filter(([, value]) => value != null),
  ),
})

export const createBrijScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml) || extractOfficialApplyUrls(careersHtml).length === 0) {
      throw new Error('The official Brij careers page no longer matches the verified first-party handoff surface')
    }

    const boardHtml = await fetchText(BOARD_URL)
    if (hasInactiveBoardSignal(boardHtml)) {
      return attachInventoryEvidence([], {
        status: 'discovery-only',
        surface: BOARD_URL,
        firstParty: true,
        listingComplete: false,
        pagesFetched: 2,
        reportedTotal: null,
        indiaFacetCount: null,
        verifiedAt: now(),
        reason: 'Verified Brij first-party careers handoff reaches a JazzHR inactive-account page; current public inventory is unavailable.',
      })
    }

    if (!hasVerifiedBoardSignal(boardHtml)) {
      throw new Error('The verified Brij ApplyToJob board no longer matches the trusted public surface')
    }

    const listings = extractBoardJobs(boardHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const job = mergeListingWithDetail(listing, extractJobDetail(detailHtml, listing))

      if (!isIndiaRole(job)) continue

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createBrijScraper().run(options)

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
