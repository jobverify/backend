import PROVIDER_METADATA from './catalog.js'
export { PROVIDER_METADATA }
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'

export const SOURCE = 'locus'
export const COMPANY = 'Locus'
export const VERIFIED_ON = '2026-10-03'
export const CAREERS_URL = 'https://locus.sh/careers/'
export const DARWINBOX_CAREERS_URL = 'https://locus.darwinbox.in/ms/candidate/careers'
export const DARWINBOX_JOBS_API_URL = 'https://locus.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main'
export const FRESHTEAM_JOBS_URL = 'https://locus.freshteam.com/jobs'
export const DETAIL_URL_PATTERN = 'https://locus.freshteam.com/jobs/{opaque_id}/{slug}'
export const DISPOSITION = PROVIDER_METADATA.verificationDisposition
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary


const currentDir = path.dirname(fileURLToPath(import.meta.url))
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

const stripDescriptionHtml = (value = '') =>
  normalizeWhitespace(
    decodeHtmlEntities(value)
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

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

export const extractFreshteamJobsUrl = (html = '') =>
  toAbsoluteUrl(
    String(html ?? '').match(/<a[^>]+href="([^"]*locus\.freshteam\.com\/jobs[^"]*)"/i)?.[1],
    CAREERS_URL,
  )

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*Careers in Locus\s*\|/i.test(page)
    && /\bThe Software Machine\b/i.test(text)
    && /\bFind your place in the Software Machine\b/i.test(text)
    && /\bHiring across engineering, product, data science, sales, and operations\./i.test(text)
    && /careers@locus\.sh/i.test(text)
    && normalizeComparableUrl(extractFreshteamJobsUrl(page))
      === normalizeComparableUrl(FRESHTEAM_JOBS_URL)
}

export const hasCurrentDarwinboxCareersSignal = (html = '') => {
  const page = String(html)
  const text = normalizeWhitespace(page) || ''
  const links = [...page.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => normalizeComparableUrl(decodeHtmlEntities(match[1])))
  return /<title[^>]*>\s*Careers in Locus\s*\|/i.test(page)
    && /\bThe Software Machine\b/i.test(text)
    && /\bLife at Locus\b/i.test(text)
    && /\bExplore Open Roles\b/i.test(text)
    && links.includes(normalizeComparableUrl(DARWINBOX_CAREERS_URL))
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

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/[']/g, '') || ''
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /remote/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/,?\s*India$/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const inferRemoteStatus = (listing = {}) => {
  const haystack = [
    listing.locationText,
    listing.dataLocation,
    listing.remoteFlag,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (haystack.includes('remote') || haystack === 'true') return 'Remote'
  if (haystack.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

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
      const locationParts = decodeHtmlEntities(locationInfo)
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

const extractDetailDepartment = (html = '') =>
  firstMatch(html, [
    /<a[^>]*class="[^"]*\blink-back\b[^"]*"[^>]*>[\s\S]*?<\/i>\s*([^<]+?)\s*<\/a>/i,
  ])

const extractDescriptionHtml = (html = '') => {
  const match = String(html ?? '').match(
    /<div[^>]*class="[^"]*\bjob-details-content\b[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*\bapplication-form\b[^"]*"[^>]*>/i,
  )

  return match?.[1] || ''
}

const isIndiaListing = (listing = {}) => {
  const haystack = [
    listing.locationText,
    listing.dataLocation,
    listing.summary,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!haystack) return false
  if (haystack.includes('united states') || haystack.includes('atlanta') || haystack.includes('new york')) {
    return false
  }
  if (haystack.includes('remote') && !haystack.includes('india')) return false
  return /(india|bengaluru|bangalore|karnataka)/i.test(haystack)
}

export const extractJobDetail = (html = '', listing = {}) => {
  const detailUrl = listing.detailUrl || buildDetailUrl(listing.jobId, listing.slug)
  const { opaqueId, slug } = extractDetailPathParts(detailUrl)
  const title = firstMatch(html, [
    /<h1[^>]*class="[^"]*\bbrand-color\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || listing.title
  const department = listing.department || extractDetailDepartment(html)
  const description = stripDescriptionHtml(extractDescriptionHtml(html))

  return {
    title,
    company: COMPANY,
    department,
    location: normalizeLocation(listing.locationText || listing.dataLocation),
    city: extractCity(listing.locationText || listing.dataLocation),
    country: 'India',
    jobId: opaqueId || listing.jobId,
    requisitionId: opaqueId || listing.requisitionId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeEmploymentType(listing.employmentType),
    experienceRequired: extractExperienceRequired(description),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    remoteStatus: inferRemoteStatus(listing),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const createLocusScraper = ({ maxJobs = null } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    fetchListingPage,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (hasCurrentDarwinboxCareersSignal(careersHtml)) {
      const native = createDarwinboxScraper({companyName: COMPANY, source: SOURCE, origin: 'https://locus.darwinbox.in', companyId: 'main'})
      const seen = new Set()
      let reportedTotal = null
      let pagesFetched = 0
      const jobs = await native.run({
        maxPages: Number.MAX_SAFE_INTEGER, maxJobs, signal,
        fetchListingPage: async (request) => {
          const payload = await (fetchListingPage || native.fetchListingPageFromApi)(request)
          if (!Number.isInteger(payload?.job_counts) || payload.job_counts < 0 || !Array.isArray(payload.data)) {
            throw new Error('Locus Darwinbox inventory count or records are malformed')
          }
          if (reportedTotal !== null && reportedTotal !== payload.job_counts) {
            throw new Error('Locus Darwinbox inventory count changed during pagination')
          }
          reportedTotal = payload.job_counts
          for (const record of payload.data) {
            if (!record?.id || seen.has(String(record.id))) throw new Error('Locus Darwinbox duplicate or missing job identity')
            seen.add(String(record.id))
            if (/india/i.test(record.country || record.locations || '') && !normalizeWhitespace(record.jd)) {
              throw new Error('Locus Darwinbox India job description is missing')
            }
          }
          pagesFetched += 1
          if (seen.size > reportedTotal || (request.page * request.pageSize >= reportedTotal && seen.size !== reportedTotal)) {
            throw new Error('Locus Darwinbox inventory is incomplete or contradicts its reported count')
          }
          return payload
        },
      })
      if (!maxJobs && seen.size !== reportedTotal) throw new Error('Locus Darwinbox inventory is incomplete')
      return attachInventoryEvidence(jobs.map((job) => ({...job, country: 'India', scrapedAt: now()})), {
        status: reportedTotal === 0 ? 'verified-empty' : 'complete-inventory',
        surface: DARWINBOX_JOBS_API_URL, firstParty: true, listingComplete: seen.size === reportedTotal,
        pagesFetched, reportedTotal, indiaFacetCount: jobs.length, verifiedAt: now(),
        reason: 'Exact official Locus handoff and complete native Darwinbox listing payload',
      })
    }

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Locus verified official careers page changed materially')
    }

    const listingUrl = extractFreshteamJobsUrl(careersHtml)
    if (normalizeComparableUrl(listingUrl) !== normalizeComparableUrl(FRESHTEAM_JOBS_URL)) {
      throw new Error('Locus verified official careers handoff no longer points to the known Freshteam board')
    }

    const listingHtml = await fetchText(FRESHTEAM_JOBS_URL)
    if (!hasFreshteamJobsBoardSignal(listingHtml)) {
      throw new Error('Locus verified public Freshteam board no longer matches the known public surface')
    }

    const listings = extractListingJobs(listingHtml)
      .filter(isIndiaListing)
      .slice(0, maxJobs ?? undefined)

    if (listings.length === 0) {
      throw new Error('Locus Freshteam board exposes no verified India jobs')
    }

    const jobs = []
    for (const listing of listings) {
      const detailHtml = await fetchText(listing.detailUrl)
      const job = extractJobDetail(detailHtml, listing)
      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createLocusScraper().run(options)

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
