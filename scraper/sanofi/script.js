import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import SANOFI_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = SANOFI_CATALOG.source
export const COMPANY = SANOFI_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SANOFI_CATALOG.officialBrandName
export const CAREERS_PAGE_URL = SANOFI_CATALOG.companyCareerPage
export const INDIA_SEARCH_URL = 'https://jobs.sanofi.com/en/search-jobs/india/20873/1/1'
export const PROVIDER_METADATA = SANOFI_CATALOG

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' '),
)

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
  signal,
})

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasOfficialIndiaCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(page)?.toLowerCase() || ''

  return /<title>\s*careers in india\s*\|\s*sanofi careers\s*<\/title>/i.test(page)
    && (
      normalized.includes('sanofi careers: india shape a bold tomorrow')
      || normalized.includes('grow your career with us in india')
    )
    && /href=["']\/en\/search-jobs(?:\/india\/20873\/1\/1)?["']/i.test(page)
}

export const extractPageCount = (html = '') => {
  const match = String(html ?? '').match(/page\s+\d+\s*\/\s*(\d+)/i)
  return match ? Number.parseInt(match[1], 10) : 1
}

export const extractSearchResults = (html = '') => {
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href=["']([^"']*\/en\/job\/[^"']+)["'][^>]*data-job-id=["'](\d+)["'][^>]*>\s*<h2>([\s\S]*?)<\/h2>\s*<span[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>[\s\S]*?<\/strong>([\s\S]*?)<\/span>\s*<span[^>]*class=["'][^"']*job-category[^"']*["'][^>]*>[\s\S]*?<\/strong>([\s\S]*?)<\/span>/gi,
  )) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const jobId = normalizeWhitespace(match[2])
    const title = normalizeWhitespace(match[3])
    const location = normalizeWhitespace(match[4])
    const department = normalizeWhitespace(match[5])

    if (!sourceUrl || !jobId || !title || !location) continue

    jobs.push({
      title,
      department,
      location,
      jobId,
      sourceUrl,
    })
  }

  return jobs
}

const extractJobPostingJson = (html = '') => {
  for (const match of String(html ?? '').matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      continue
    }
  }

  return null
}

const extractApplyUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/jobs\.sanofi\.com\/sys\/apply\/job\/application\/[^"']+)["'][^>]*data-apply-mobile=["']true["']/i,
  )
  return match ? match[1] : null
}

const extractClosingDate = (html = '') => {
  const match = String(html ?? '').match(/\bJobPostingEndDate-(\d{4}-\d{2}-\d{2})\b/i)
  return match ? new Date(`${match[1]}T00:00:00.000Z`) : null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^regular$/i.test(normalized)) return 'Full-time'
  return normalized
}

const extractDescriptionSection = (descriptionHtml = '') => {
  const match = String(descriptionHtml ?? '').match(
    /<p><b>About the job<\/b><\/p>([\s\S]*?)(?:<p><b>About you<\/b><\/p>|<p><b>Why choose us\?<\/b><\/p>|$)/i,
  )
  const body = match ? match[1] : descriptionHtml
  return stripTags(body)
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalizeWhitespace(normalized.split(',')[0])
}

export const extractJobFromDetailPage = (summary, html = '') => {
  const posting = extractJobPostingJson(html)
  if (!posting) return null

  const locationEntries = Array.isArray(posting.jobLocation)
    ? posting.jobLocation
    : [posting.jobLocation].filter(Boolean)
  const locationAddress = locationEntries
    .map((entry) => entry?.address)
    .find((address) => /\bindia\b/i.test(String(address?.addressCountry ?? '')))
    || locationEntries[0]?.address

  const city = normalizeWhitespace(locationAddress?.addressLocality)
    || extractCity(summary?.location)
  const country = normalizeWhitespace(locationAddress?.addressCountry) || 'India'
  const title = normalizeWhitespace(posting.title) || normalizeWhitespace(summary?.title)
  const sourceUrl = normalizeWhitespace(posting.url) || normalizeWhitespace(summary?.sourceUrl)
  const applyUrl = extractApplyUrl(html) || sourceUrl
  const location = city && country ? `${city}, ${country}` : normalizeWhitespace(summary?.location)

  if (!title || !sourceUrl || !location || !/\bindia\b/i.test(location)) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(summary?.department),
    location,
    city,
    country,
    jobId: normalizeWhitespace(summary?.jobId),
    requisitionId: normalizeWhitespace(posting.identifier),
    sourceUrl,
    applyUrl,
    employmentType: normalizeEmploymentType(posting.employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(posting.datePosted),
    closingDate: extractClosingDate(html),
    jobDescription: extractDescriptionSection(posting.description),
    remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
  }
}

const getSearchPageUrl = (pageNumber) =>
  pageNumber <= 1
    ? INDIA_SEARCH_URL
    : `https://jobs.sanofi.com/en/search-jobs/india/20873/1/${pageNumber}`

export const createSanofiScraper = ({ maxJobs = Number.POSITIVE_INFINITY } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL, { signal })
    if (!hasOfficialIndiaCareersSignal(careersHtml)) {
      throw new Error('Verified Sanofi India careers page changed materially')
    }

    const firstPageHtml = await fetchText(INDIA_SEARCH_URL, { signal })
    const totalPages = extractPageCount(firstPageHtml)
    const summaries = extractSearchResults(firstPageHtml)

    if (summaries.length === 0) {
      throw new Error('Verified Sanofi India search page no longer exposes public India job cards')
    }

    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
      const pageHtml = await fetchText(getSearchPageUrl(pageNumber), { signal })
      summaries.push(...extractSearchResults(pageHtml))
    }

    const uniqueSummaries = [...new Map(
      summaries.map((job) => [job.sourceUrl, job]),
    ).values()].slice(0, maxJobs)

    const jobs = []

    for (const summary of uniqueSummaries) {
      const detailHtml = await fetchText(summary.sourceUrl, { signal })
      const job = extractJobFromDetailPage(summary, detailHtml)
      if (job) jobs.push(job)
    }

    if (jobs.length === 0) {
      throw new Error('Verified Sanofi job detail pages changed materially')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSanofiScraper(options).run(options)

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
