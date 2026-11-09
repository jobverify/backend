import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { INVENGER_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INVENGER_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const BASE_URL = 'https://www.invenger.com'
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const JOBS_PAGE_URL = PROVIDER_METADATA.officialJobsPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const buildAbsoluteUrl = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  try {
    return new URL(normalized, `${BASE_URL}/`).toString()
  } catch {
    return normalized
  }
}

const extractJobId = (url) => buildAbsoluteUrl(url)?.match(/-(\d+)\/?$/)?.[1] || null

const normalizeEmploymentType = (value) => normalizeOptionalValue(value)

const normalizeLocation = ({ city, state, country }) => {
  const locationParts = [normalizeOptionalValue(city), normalizeOptionalValue(state), normalizeOptionalValue(country)]
    .filter(Boolean)

  return {
    location: locationParts.join(', ') || null,
    city: normalizeCity(normalizeOptionalValue(city)),
    state: normalizeOptionalValue(state),
    country: normalizeOptionalValue(country),
  }
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Invenger scraper')
  }

  return parsed.toISOString()
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const hasLegacyCareersSurface = /careers\s*\|\s*invenger/i.test(page)
    && /info@invenger\.com/i.test(page)
    && /india\s*office\s*location/i.test(page)
  const hasCurrentJobsHandoff = /careers\s*\|\s*invenger/i.test(page)
    && /href=["'][^"']*\/jobs["']/i.test(page)
    && /invenger/i.test(page)

  return hasLegacyCareersSurface || hasCurrentJobsHandoff
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Jobs\s*\|\s*Invenger\s*<\/title>/i.test(page)
    && /open position/i.test(page)
    && /href=["']\/jobs\/[a-z0-9-]+-\d+["']/i.test(page)
}

export const extractJobCards = (html) => {
  if (!hasOfficialJobsPageSignal(html)) {
    throw new Error('Expected verified Invenger jobs page with public listings')
  }

  const cards = []

  for (const match of String(html ?? '').matchAll(/<a[^>]+href="(\/jobs\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, rawHref, blockHtml] = match
    const title = normalizeOptionalValue(blockHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    if (!title) continue

    const city = normalizeOptionalValue(blockHtml.match(/itemprop="addressLocality">([\s\S]*?)<\/span>/i)?.[1])
    const state = normalizeOptionalValue(blockHtml.match(/itemprop="addressRegion">([\s\S]*?)<\/span>/i)?.[1])
    const country = normalizeOptionalValue(blockHtml.match(/itemprop="addressCountry">([\s\S]*?)<\/span>/i)?.[1])
    const locationBits = normalizeLocation({ city, state, country })

    cards.push({
      title,
      detailUrl: buildAbsoluteUrl(rawHref),
      openingsLabel: stripTags(blockHtml.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1]),
      summary: stripTags(blockHtml.match(/<div[^>]*class="oe_empty[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]),
      employmentType: normalizeEmploymentType(
        blockHtml.match(/title="Employment type"[\s\S]*?<span[^>]*class="fw-light"[^>]*>([\s\S]*?)<\/span>/i)?.[1],
      ),
      location: locationBits.location,
      city: locationBits.city,
      state: locationBits.state,
      country: locationBits.country,
      jobId: extractJobId(rawHref),
    })
  }

  if (cards.length === 0) {
    throw new Error('Expected verified Invenger jobs page with public listings')
  }

  return cards
}

export const extractJobDetail = (detailHtml, listing) => {
  const html = String(detailHtml ?? '')
  const title = normalizeOptionalValue(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const applyUrl = buildAbsoluteUrl(
    html.match(/<a[^>]+href="([^"]*\/jobs\/apply\/[^"]+)"[^>]*>\s*Apply Now!?/i)?.[1],
  )

  if (!title || title !== listing.title || !applyUrl) {
    throw new Error('Expected verified Invenger detail page with a matching title and public apply URL')
  }

  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  const description = normalizeOptionalValue(
    paragraphs.filter((paragraph) => paragraph !== listing.location).join(' '),
  )

  return {
    title: listing.title,
    company: COMPANY,
    department: null,
    location: listing.location,
    city: listing.city,
    state: listing.state,
    country: listing.country,
    jobId: listing.jobId,
    requisitionId: listing.jobId,
    sourceUrl: listing.detailUrl,
    applyUrl,
    employmentType: listing.employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description || listing.summary,
    remoteStatus: 'On-site',
  }
}

export const createInvengerScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, maxJobs: overrideMaxJobs, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Expected verified Invenger careers page with first-party branding')
    }

    const jobsHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasOfficialJobsPageSignal(jobsHtml)) {
      throw new Error('Expected verified Invenger jobs page with public listings')
    }

    const listings = extractJobCards(jobsHtml)
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

export const run = async (options = {}) => createInvengerScraper().run(options)

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
