import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import NETFLIX_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = NETFLIX_CATALOG.source
export const COMPANY = NETFLIX_CATALOG.companyName
export const LOCATION_PAGE_URL = NETFLIX_CATALOG.companyCareerPage
export const EXPLORE_JOBS_BASE_URL = NETFLIX_CATALOG.exploreJobsBaseUrl
export const COMPANY_DOMAIN = NETFLIX_CATALOG.companyDomain
export const VERIFIED_ON = NETFLIX_CATALOG.verifiedOn
export const PROVIDER_METADATA = NETFLIX_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const POSITIONS_MARKER = '&#34;positions&#34;:'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => (
  String(value ?? '')
    .replace(/&#34;/g, '"')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#47;/g, '/')
    .replace(/&#61;/g, '=')
    .replace(/&#58;/g, ':')
)

const normalizeLocation = (value) => (
  normalizeWhitespace(
    String(value ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', '),
  )
)

const extractCountry = (location) => {
  const parts = String(location ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.at(-1) || null
}

const extractCity = (location) => {
  const parts = String(location ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return parts[0] || null
}

const toRemoteStatus = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'remote') return 'Remote'
  return null
}

const isIndiaLocation = (location) => /(^|, )india$/i.test(String(location ?? ''))

export const hasVerifiedLocationPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Work in Mumbai - Careers at Netflix\s*<\/title>/i.test(page)
    && /Working at Netflix in India/i.test(page)
    && /https:\/\/explore\.jobs\.netflix\.net\/careers\?location=Mumbai/i.test(page)
}

export const extractExploreJobsUrl = (html) => {
  const page = String(html ?? '')
  const match = page.match(/href="(https:\/\/explore\.jobs\.netflix\.net\/careers\?location=Mumbai[^"]+)"/i)
  if (!match?.[1]) {
    throw new Error('Netflix verified Mumbai location page no longer exposes the public explore jobs handoff')
  }

  return decodeHtmlEntities(match[1])
}

export const hasVerifiedExplorePageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Netflix jobs in Mumbai, MH, India\s*<\/title>/i.test(page)
    && /search-results-main-container/i.test(page)
    && /&#34;companyName&#34;:\s*&#34;Netflix&#34;/i.test(page)
    && page.includes(POSITIONS_MARKER)
}

const extractEncodedArray = (html, marker) => {
  const page = String(html ?? '')
  const markerIndex = page.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error('Netflix verified explore jobs page no longer exposes the embedded positions state')
  }

  const startIndex = page.indexOf('[', markerIndex)
  if (startIndex < 0) {
    throw new Error('Netflix verified explore jobs page no longer exposes the embedded positions array')
  }

  let depth = 0
  for (let index = startIndex; index < page.length; index += 1) {
    if (page[index] === '[') depth += 1
    if (page[index] === ']') {
      depth -= 1
      if (depth === 0) {
        return page.slice(startIndex, index + 1)
      }
    }
  }

  throw new Error('Netflix verified explore jobs page no longer closes the embedded positions array')
}

export const extractEncodedPositionSummaries = (html) => {
  const encodedArray = extractEncodedArray(html, POSITIONS_MARKER)
  const decodedArray = decodeHtmlEntities(encodedArray)
  const positions = JSON.parse(decodedArray)

  if (!Array.isArray(positions)) {
    throw new Error('Netflix verified explore jobs page no longer exposes positions as an array')
  }

  return positions.map((position) => {
    const location = normalizeLocation(position?.location || position?.locations?.[0])
    const sourceUrl = normalizeWhitespace(position?.canonicalPositionUrl)

    if (!position?.id || !position?.name || !location || !sourceUrl) {
      throw new Error('Netflix verified explore jobs page no longer exposes the expected public position fields')
    }

    return {
      jobId: String(position.id),
      requisitionId: normalizeWhitespace(position?.display_job_id || position?.ats_job_id),
      title: normalizeWhitespace(position.name),
      department: normalizeWhitespace(position?.department),
      location,
      sourceUrl,
      applyUrl: sourceUrl,
      remoteStatus: toRemoteStatus(position?.work_location_option),
    }
  })
}

export const extractJobPostingJsonLd = (html) => {
  const blocks = [...String(html ?? '').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]

  for (const [, block] of blocks) {
    try {
      const parsed = JSON.parse(block)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Skip malformed JSON-LD blocks and keep looking for the public JobPosting payload.
    }
  }

  return null
}

const decorateJob = (summary, jobPosting, scrapedAt) => ({
  title: summary.title,
  company: COMPANY,
  department: summary.department,
  location: summary.location,
  city: extractCity(summary.location),
  country: extractCountry(summary.location),
  jobId: summary.jobId,
  requisitionId: summary.requisitionId,
  sourceUrl: summary.sourceUrl,
  applyUrl: summary.applyUrl,
  employmentType: normalizeWhitespace(jobPosting?.employmentType),
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: normalizeWhitespace(jobPosting?.datePosted),
  closingDate: normalizeWhitespace(jobPosting?.validThrough),
  jobDescription: normalizeWhitespace(jobPosting?.description),
  remoteStatus: summary.remoteStatus,
  source: SOURCE,
  link: summary.applyUrl || summary.sourceUrl,
  scrapedAt,
  companyCareerPage: LOCATION_PAGE_URL,
  companyDomain: COMPANY_DOMAIN,
  atsPlatform: NETFLIX_CATALOG.atsPlatform,
})

export const createNetflixScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const locationPageHtml = await fetchText(LOCATION_PAGE_URL)
    if (!hasVerifiedLocationPageSignal(locationPageHtml)) {
      throw new Error('Netflix verified Mumbai location page changed materially')
    }

    const exploreJobsUrl = extractExploreJobsUrl(locationPageHtml)
    const explorePageHtml = await fetchText(exploreJobsUrl)
    if (!hasVerifiedExplorePageSignal(explorePageHtml)) {
      throw new Error('Netflix verified explore jobs page changed materially')
    }

    const indiaSummaries = extractEncodedPositionSummaries(explorePageHtml)
      .filter((summary) => isIndiaLocation(summary.location))

    const scrapedAt = now()
    const jobs = []

    for (const summary of indiaSummaries) {
      const detailHtml = await fetchText(summary.sourceUrl)
      const jobPosting = extractJobPostingJsonLd(detailHtml)
      if (!jobPosting) {
        throw new Error('Netflix verified detail page no longer exposes the public JobPosting payload')
      }

      jobs.push(decorateJob(summary, jobPosting, scrapedAt))
    }

    return jobs
  },
})

export const run = async (options = {}) => createNetflixScraper().run(options)

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
