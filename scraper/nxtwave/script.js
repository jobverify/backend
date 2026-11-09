import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = 'NxtWave'
export const COUNTRY_FILTER = 'India'
export const COMPANY_CAREERS_URL = 'https://www.ccbp.in/careers'
export const LISTING_URL = 'https://nxtwave.freshteam.com/jobs'
export const DETAIL_URL_PATTERN = 'https://nxtwave.freshteam.com/jobs/{opaque_id}/{slug}'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
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

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, LISTING_URL).toString()
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
  if (normalized.includes('remote') || normalized.includes('work from home')) return 'Remote'
  return 'On-site'
}

const extractExperienceRequired = (value) =>
  normalizeWhitespace((normalizeWhitespace(value) || '').match(/\b\d+\s*(?:\+|-\s*\d+)\s*years\b/i)?.[0])

const extractDescriptionHtml = (source) => {
  const html = String(source ?? '')
  const jobBody = html.match(/<div[^>]*class="[^"]*\bjob-body\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<h[1-6][^>]*>\s*Submit Your Application/i)
  if (jobBody?.[1]) return jobBody[1]

  const betweenMarkers = html.match(/<a[^>]*>\s*Apply Now\s*<\/a>([\s\S]*?)(?:<h[1-6][^>]*>\s*Submit Your Application|Submit Your Application)/i)
  if (betweenMarkers?.[1]) return betweenMarkers[1]

  return html
}

export const buildDetailUrl = (opaqueId, slug) =>
  DETAIL_URL_PATTERN
    .replace('{opaque_id}', opaqueId)
    .replace('{slug}', slug)

export const extractListingJobs = (html) => {
  const jobsByUrl = new Map()
  let currentDepartment = null
  const tokenPattern = /<(h2|h3|h4|h5)[^>]*>\s*([\s\S]*?)\s*<\/\1>|<a[^>]+href="([^"]*\/jobs\/[^"/?#]+\/[^"/?#]+)"[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of String(html ?? '').matchAll(tokenPattern)) {
    if (match[2]) {
      const heading = normalizeWhitespace(match[2])
      if (heading && !/careers|open positions|open role|open roles/i.test(heading)) {
        currentDepartment = heading
      }
      continue
    }

    const detailUrl = toAbsoluteUrl(match[3])
    if (!detailUrl || jobsByUrl.has(detailUrl)) continue

    const { opaqueId, slug } = extractDetailPathParts(detailUrl)
    jobsByUrl.set(detailUrl, {
      title: normalizeWhitespace(match[4]),
      department: currentDepartment,
      detailUrl,
      jobId: opaqueId,
      requisitionId: opaqueId,
      slug,
    })
  }

  return [...jobsByUrl.values()]
}

export const extractJobDetail = (html, listing = {}) => {
  const source = String(html ?? '')
  const detailUrl = listing.detailUrl || listing.sourceUrl || buildDetailUrl(listing.jobId, listing.slug)
  const { opaqueId, slug } = extractDetailPathParts(detailUrl)
  const title = firstMatch(source, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || listing.title
  const department = firstMatch(source, [
    /<div[^>]*class="[^"]*\bjob-department\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ]) || listing.department
  const meta = firstMatch(source, [
    /<div[^>]*class="[^"]*\bjob-meta\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<p[^>]*class="[^"]*\bjob-meta\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
  ])
  const [rawLocation, rawEmploymentType] = String(meta || '')
    .split('|')
    .map((part) => normalizeWhitespace(part))
  const descriptionHtml = extractDescriptionHtml(source)
  const jobDescription = normalizeWhitespace(descriptionHtml)
  const location = normalizeLocation(rawLocation)

  return {
    title,
    company: COMPANY_NAME,
    department,
    location,
    city: extractCity(rawLocation),
    country: COUNTRY_FILTER,
    jobId: listing.jobId || opaqueId || slug,
    requisitionId: listing.requisitionId || opaqueId || slug,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeEmploymentType(rawEmploymentType),
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(rawLocation, jobDescription),
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
  label: 'nxtwave',
  timeoutMs: 15000,
})

export const createNxtWaveScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())
    const listingHtml = await fetchText(LISTING_URL)
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
      source: 'nxtwave',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createNxtWaveScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running NxtWave scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'nxtwave')
    console.log('DB result:', result)
    process.exit(0)
  }
}
