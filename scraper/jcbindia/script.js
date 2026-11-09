import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { JCB_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = JCB_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const BASE_URL = 'https://career-in.jcb.com'
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const JOBS_BOARD_URL = PROVIDER_METADATA.officialJobsBoardUrl
export const SEARCH_PAGE_URL = PROVIDER_METADATA.accessibleSearchUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl = BASE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const parseDateToIso = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) return null

  const [, dayValue, monthValue, yearValue] = match
  const monthIndex = MONTH_INDEX[monthValue.toLowerCase()]
  if (monthIndex == null) return null

  const year = Number.parseInt(yearValue, 10)
  const day = Number.parseInt(dayValue, 10)
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10)
}

const normalizeLocation = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  if (normalized.toUpperCase() === 'IN') return 'India'
  if (/,\s*IN$/i.test(normalized)) return normalized.replace(/,\s*IN$/i, ', India')
  return normalized
}

const normalizeCountry = (value) => {
  const normalized = normalizeLocation(value)
  if (!normalized) return null
  if (/,\s*India$/i.test(normalized)) return 'India'
  if (normalized.toUpperCase() === 'IN') return 'India'
  if (normalized.toLowerCase() === 'india') return 'India'
  return normalized
}

const extractJobId = (url) => toAbsoluteUrl(url)?.match(/\/(\d+)\/?$/)?.[1] || null

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to JCB India scraper')
  }

  return parsed.toISOString()
}

const defaultFetchText = async (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const unique = (values) => [...new Set(values.filter(Boolean))]

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /careers/i.test(page)
    && normalized.includes('Welcome to JCB Careers')
    && normalized.includes('At JCB India we believe that people are our biggest asset.')
    && /career-in\.jcb\.com/i.test(page)
}

export const hasSearchResultsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Search results for ""')
    && /id=["']searchresults["']/i.test(page)
    && /\/job\/[^"']+\/\d+\/?/i.test(page)
}

export const extractSearchPageUrls = (html) => {
  const pageUrls = new Map([[SEARCH_PAGE_URL, 1]])

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']*\/search\/[^"']*)["'][^>]*>/gi)) {
    const url = toAbsoluteUrl(match[1], BASE_URL)
    const pageNumber = Number.parseInt(new URL(url).searchParams.get('pg') || '1', 10)
    if (!Number.isNaN(pageNumber)) {
      pageUrls.set(url, pageNumber)
    }
  }

  return [...pageUrls.entries()]
    .sort((left, right) => left[1] - right[1])
    .map(([url]) => url)
}

export const extractJobCards = (html) => {
  if (!hasSearchResultsSignal(html)) {
    throw new Error('Expected verified JCB India search results page with public listings')
  }

  const cards = []

  for (const match of String(html ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1]
    const linkMatch = rowHtml.match(/<a[^>]+href=["']([^"']*\/job\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!linkMatch) continue

    const [, href, titleHtml] = linkMatch
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripTags(cell[1]))
    const title = normalizeOptionalValue(titleHtml)
    const detailUrl = toAbsoluteUrl(href, BASE_URL)
    const locationValue = cells[1] || null
    const postingDate = parseDateToIso(cells[2])

    if (!title || !detailUrl) continue

    cards.push({
      title,
      detailUrl,
      location: normalizeLocation(locationValue),
      country: normalizeCountry(locationValue),
      postingDate,
      jobId: extractJobId(detailUrl),
    })
  }

  if (cards.length === 0) {
    throw new Error('Expected verified JCB India search results page with public listings')
  }

  return cards
}

export const extractJobDetail = (detailHtml, listing) => {
  const html = String(detailHtml ?? '')
  const title = normalizeOptionalValue(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const explicitApplyUrl = toAbsoluteUrl(
    html.match(/<a[^>]+href=["']([^"']*\/job\/[^"']+\/apply(?:\/)?[^"']*)["'][^>]*>\s*Apply now/i)?.[1],
    BASE_URL,
  )
  const locationLabel = normalizeLocation(html.match(/Location:\s*([^<\r\n]+)/i)?.[1])
  const jobSegmentText = normalizeOptionalValue(
    [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => stripTags(match[1]))
      .find((paragraph) => /^Job Segment:/i.test(paragraph)),
  )

  const applyUrl = explicitApplyUrl || listing.detailUrl

  if (!title || title !== listing.title || !applyUrl) {
    throw new Error('Expected verified JCB India detail page with matching title and apply URL')
  }

  const description = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((paragraph) => paragraph && !/^Job Segment:/i.test(paragraph))
    .join(' ')
    .trim()

  const requiredSkills = unique(
    String(jobSegmentText || '')
      .replace(/^Job Segment:\s*/i, '')
      .split(',')
      .map((item) => normalizeOptionalValue(item)),
  )

  return {
    title: listing.title,
    company: COMPANY,
    department: null,
    location: locationLabel || listing.location,
    city: null,
    state: null,
    country: listing.country,
    jobId: listing.jobId,
    requisitionId: listing.jobId,
    sourceUrl: listing.detailUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: listing.postingDate,
    closingDate: null,
    jobDescription: description || null,
    remoteStatus: null,
  }
}

export const createJcbIndiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, maxJobs: overrideMaxJobs, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Expected verified JCB India careers page with first-party branding')
    }

    const firstSearchPageHtml = await fetchText(SEARCH_PAGE_URL)
    if (!hasSearchResultsSignal(firstSearchPageHtml)) {
      throw new Error('Expected verified JCB India search results page with public listings')
    }

    const searchPageUrls = extractSearchPageUrls(firstSearchPageHtml)
    const listingMap = new Map()

    for (const [index, searchPageUrl] of searchPageUrls.entries()) {
      const searchHtml = index === 0 ? firstSearchPageHtml : await fetchText(searchPageUrl)
      if (!hasSearchResultsSignal(searchHtml)) {
        throw new Error('Expected verified JCB India search results page with public listings')
      }

      for (const card of extractJobCards(searchHtml)) {
        if (card.detailUrl) {
          listingMap.set(card.detailUrl, card)
        }
      }
    }

    const listings = [...listingMap.values()].sort((left, right) => left.title.localeCompare(right.title))
    const limit = Number.isInteger(overrideMaxJobs) ? overrideMaxJobs : maxJobs
    const selectedListings = limit ? listings.slice(0, limit) : listings
    const scrapedAt = normalizeScrapedAt((overrideNow || now)())
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.detailUrl)
      const job = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createJcbIndiaScraper().run(options)

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
