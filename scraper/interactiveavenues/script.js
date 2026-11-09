import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INTERACTIVE_AVENUES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = INTERACTIVE_AVENUES_CATALOG.source
export const COMPANY = INTERACTIVE_AVENUES_CATALOG.companyName
export const PROVIDER_METADATA = INTERACTIVE_AVENUES_CATALOG
export const CAREERS_LANDING_URL = INTERACTIVE_AVENUES_CATALOG.officialCareersLandingUrl
export const JOBS_HUB_URL = INTERACTIVE_AVENUES_CATALOG.officialJobsHubUrl
export const JOBS_PAGE_URL = INTERACTIVE_AVENUES_CATALOG.companyCareerPage
export const GREENHOUSE_JOBS_BASE_URL = INTERACTIVE_AVENUES_CATALOG.greenhouseJobsBaseUrl
export const GREENHOUSE_BOARD_EMBED_URL = INTERACTIVE_AVENUES_CATALOG.greenhouseBoardEmbedUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|strong|u)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

const canonicalizePostingQueryUrl = (url) => {
  const normalizedPathname = url.pathname.replace(/\/+$/, '/')
  const isInteractiveAvenuesPostingPath = normalizedPathname === '/postings/' || normalizedPathname === '/posting-greenhouse/'
  const isMediabrandsCareersHost = /^careers\.ipgmediabrands\.com$/i.test(url.hostname)

  if (!isInteractiveAvenuesPostingPath) {
    return url.toString()
  }

  const canonicalOrigin = isMediabrandsCareersHost
    ? `https://${url.hostname}`
    : url.origin
  const canonicalUrl = new URL(`${canonicalOrigin}${normalizedPathname}`)
  const params = new URLSearchParams(url.search)
  const orderedKeys = ['gh_search', 'department', 'interest', 'location', 'job_id']

  for (const key of orderedKeys) {
    if (params.has(key)) {
      canonicalUrl.searchParams.set(key, params.get(key) ?? '')
    }
  }

  for (const [key, value] of params.entries()) {
    if (!orderedKeys.includes(key)) {
      canonicalUrl.searchParams.set(key, value)
    }
  }

  return canonicalUrl.toString()
}

const toAbsoluteUrl = (value, baseUrl = JOBS_PAGE_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeUrlWithoutHash = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    url.hash = ''
    return canonicalizePostingQueryUrl(url)
  } catch {
    return absoluteUrl
  }
}

const extractFieldByLabel = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(
    new RegExp(`<span[^>]*>\\s*${escapedLabel}\\s*<\\/span>([\\s\\S]*?)<\\/div>`, 'i'),
  )

  return normalizeWhitespace(match?.[1])
}

const extractJobIdFromUrl = (value) => {
  try {
    return new URL(String(value ?? '')).searchParams.get('job_id')
  } catch {
    return null
  }
}

const extractEmbeddedJobId = (html) =>
  String(html ?? '').match(/Grnhse\.Iframe\.load\(['"](\d+)['"]\)/i)?.[1] || null

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

const inferRemoteStatus = (...values) => {
  const normalized = values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersLandingSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /Careers at IA/i.test(rawHtml)
    && /We are hiring!/i.test(rawHtml)
    && /Open positions/i.test(rawHtml)
    && normalized.includes('Careers at IA')
    && /Interactive\+Avenues\+-\+India/i.test(rawHtml)
}

export const extractVerifiedJobsHubUrl = (html) => {
  const match = String(html ?? '').match(
    /href="([^"]*careers\.ipgmediabrands\.com\/postings\/\?[^"]*department=Interactive\+Avenues\+-\+India[^"]*)"/i,
  )

  return normalizeUrlWithoutHash(match?.[1])
}

export const hasOfficialJobsHubSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /id="gh_jobs"/i.test(rawHtml)
    && /US \| Canada \| UK/i.test(rawHtml)
    && /All other Locations/i.test(rawHtml)
    && /posting-greenhouse/i.test(rawHtml)
    && normalized.includes('Your Future Starts Here: Lead the New Era of Media and Marketing with us')
}

export const extractGreenhouseJobsBaseUrl = (html) => {
  const match = String(html ?? '').match(
    /href="([^"]*careers\.ipgmediabrands\.com\/posting-greenhouse\/[^"]*)"[^>]*>\s*All other Locations\s*<\/a>/i,
  )

  return normalizeUrlWithoutHash(match?.[1])
}

export const buildFilteredJobsPageUrl = (baseUrl = GREENHOUSE_JOBS_BASE_URL) => {
  const url = new URL(baseUrl)
  url.hash = ''
  url.search = ''
  url.searchParams.set('gh_search', '')
  url.searchParams.set('department', 'Interactive Avenues - India')
  url.searchParams.set('interest', '')
  url.searchParams.set('location', 'India')
  return url.toString()
}

export const hasOfficialJobsPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /id="ghjobs"/i.test(rawHtml)
    && /Interactive Avenues - India/i.test(rawHtml)
    && /India \(All\)/i.test(rawHtml)
    && /Apply Now/i.test(rawHtml)
    && normalized.includes('Position')
    && normalized.includes('Agency')
    && normalized.includes('Location')
}

export const extractListingCards = (html) => {
  const listings = []
  const pattern =
    /<div class="gh-job-title">([\s\S]*?)<\/div>\s*<div class="gh-job-type">([\s\S]*?)<\/div>\s*<div class="gh-job-location">([\s\S]*?)<\/div>\s*<div class="gh-job-apply">[\s\S]*?<a[^>]+href="([^"]*job_id=\d+[^"]*)"[^>]*>\s*Apply Now\s*<\/a>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const title = normalizeWhitespace(match[1])?.replace(/^Positions:\s*/i, '') || null
    const department = normalizeWhitespace(match[2])?.replace(/^Agency:\s*/i, '') || null
    const location = normalizeWhitespace(match[3])?.replace(/^Location:\s*/i, '') || null
    const detailUrl = normalizeUrlWithoutHash(match[4])
    const jobId = extractJobIdFromUrl(detailUrl)

    if (!title || !department || !location || !detailUrl || !jobId) continue

    listings.push({
      title,
      department,
      location,
      detailUrl,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      jobId,
      requisitionId: null,
    })
  }

  return listings
}

export const hasOfficialJobDetailSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /Position Summary/i.test(rawHtml)
    && /Agency:/i.test(rawHtml)
    && /Ref#:/i.test(rawHtml)
    && /Type of Contract:/i.test(rawHtml)
    && rawHtml.includes(GREENHOUSE_BOARD_EMBED_URL)
    && /Grnhse\.Iframe\.load\(['"]\d+['"]\)/i.test(rawHtml)
    && normalized.includes('Apply Now')
}

export const extractJobDetail = (
  html,
  listing = {},
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const detailUrl = listing.detailUrl || listing.sourceUrl || listing.applyUrl
  const title = normalizeWhitespace(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || listing.title
  const location = extractFieldByLabel(html, 'Location:') || listing.location || null
  const department = extractFieldByLabel(html, 'Agency:') || listing.department || null
  const requisitionId = extractFieldByLabel(html, 'Ref#:')
  const employmentType = extractFieldByLabel(html, 'Type of Contract:')
  const jobId = extractEmbeddedJobId(html) || listing.jobId || extractJobIdFromUrl(detailUrl)
  const descriptionMatch = String(html ?? '').match(
    /<div class="job-content">([\s\S]*?)<\/div>\s*(?:<button|<div class="gh-job-apply-section">)/i,
  )
  const jobDescription = normalizeWhitespace(descriptionMatch?.[1])

  if (!title || !location || !department || !jobId || !detailUrl) {
    throw new Error('Interactive Avenues verified detail page no longer exposes the expected public job fields')
  }

  if (listing.jobId && jobId !== listing.jobId) {
    throw new Error('Interactive Avenues verified detail page job id no longer matches the filtered listing row')
  }

  return {
    title,
    company: COMPANY,
    department,
    location,
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId: requisitionId || null,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: employmentType || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: jobDescription || null,
    remoteStatus: inferRemoteStatus(location, jobDescription),
    source: SOURCE,
    link: detailUrl,
    scrapedAt,
  }
}

export const createInteractiveAvenuesScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersLandingHtml = await fetchText(CAREERS_LANDING_URL)
    if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
      throw new Error('Interactive Avenues careers landing page no longer matches the verified first-party surface')
    }

    const jobsHubUrl = extractVerifiedJobsHubUrl(careersLandingHtml)
    if (jobsHubUrl !== JOBS_HUB_URL) {
      throw new Error('Interactive Avenues careers landing page no longer hands off to the verified jobs hub')
    }

    const jobsHubHtml = await fetchText(JOBS_HUB_URL)
    if (!hasOfficialJobsHubSignal(jobsHubHtml)) {
      throw new Error('Interactive Avenues verified jobs hub no longer matches the first-party surface')
    }

    const greenhouseJobsBaseUrl = extractGreenhouseJobsBaseUrl(jobsHubHtml)
    if (greenhouseJobsBaseUrl !== GREENHOUSE_JOBS_BASE_URL) {
      throw new Error('Interactive Avenues verified jobs hub no longer links to the first-party greenhouse listings page')
    }

    const jobsPageUrl = buildFilteredJobsPageUrl(greenhouseJobsBaseUrl)
    if (jobsPageUrl !== JOBS_PAGE_URL) {
      throw new Error('Interactive Avenues verified jobs hub no longer resolves to the filtered greenhouse jobs page')
    }

    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasOfficialJobsPageSignal(jobsPageHtml)) {
      throw new Error('Interactive Avenues verified filtered greenhouse jobs page no longer matches the first-party surface')
    }

    const listings = extractListingCards(jobsPageHtml)
    if (listings.length === 0) {
      throw new Error('Interactive Avenues verified filtered greenhouse jobs page no longer exposes public job rows')
    }

    const selectedListings = Number.isFinite(maxJobs) ? listings.slice(0, maxJobs) : listings
    const scrapedAt = now()
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.detailUrl)
      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error(`Interactive Avenues verified detail page drifted: ${listing.detailUrl}`)
      }

      jobs.push(extractJobDetail(detailHtml, listing, { scrapedAt }))
    }

    return jobs
  },
})

export const run = async (options = {}) => createInteractiveAvenuesScraper(options).run(options)

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
