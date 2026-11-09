import path from 'path'
import { fileURLToPath } from 'url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'marutair'
export const COMPANY = 'Marut Air'
export const BASE_URL = 'https://crm.marutair.com'
export const BRAND_PAGE_URL = 'https://marutair.com/about-us/'
export const JOBS_PAGE_URL = `${BASE_URL}/jobs`

export const PRIMARY_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
export const FALLBACK_USER_AGENT = 'curl/8.7.1'
const REQUEST_TIMEOUT_MS = 15000

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

const normalizeLocation = ({ city, country }) => {
  const normalizedCity = normalizeOptionalValue(city)
  const normalizedCountry = normalizeOptionalValue(country)
  const canonicalCity = normalizeCity(normalizedCity)
  const locationParts = [canonicalCity, normalizedCountry].filter(Boolean)

  return {
    location: locationParts.join(', ') || null,
    city: canonicalCity,
    state: null,
    country: normalizedCountry,
  }
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Marut Air scraper')
  }

  return parsed.toISOString()
}

const normalizedTextEquals = (left, right) => normalizeWhitespace(left).toLowerCase()
  === normalizeWhitespace(right).toLowerCase()

const fetchTextWithUserAgent = (url, userAgent, fetchTextImpl = fetchTextWithRetry) => fetchTextImpl(url, {
  headers: {
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: REQUEST_TIMEOUT_MS,
})

export const isMarutAirFallbackableTransportError = (error) =>
  /connect timeout error|timed out|timeout|fetch failed|getaddrinfo|other side closed|terminated/i
    .test(String(error?.message ?? error?.cause?.message ?? error ?? ''))

const errorHasHttpStatus = (error, status) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (Number(current?.status) === status) {
      return true
    }
    current = current?.cause
  }

  return false
}

export const createMarutAirFetchText = ({
  fetchTextImpl = fetchTextWithRetry,
} = {}) => async (url) => {
  try {
    return await fetchTextWithUserAgent(url, PRIMARY_USER_AGENT, fetchTextImpl)
  } catch (error) {
    if (!isMarutAirFallbackableTransportError(error)) {
      throw error
    }

    return fetchTextWithUserAgent(url, FALLBACK_USER_AGENT, fetchTextImpl)
  }
}

const defaultFetchText = createMarutAirFetchText()

export const hasBrandPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /About Marut Air/i.test(page)
    && /Leading\s+HVLS\s+Fan\s+Manufacturer\s+in\s+Ahmedabad,\s*India/i.test(text)
    && /All Rights Reserved by Marut Air/i.test(text)
    && /\bCareer\b/i.test(text)
}

const hasBrandPageChallengeSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title[^>]*>\s*You are being redirected\.\.\.\s*<\/title>/i.test(page)
    && /javascript is required/i.test(text)
    && /please enable javascript before you are allowed to see this page/i.test(text)
    && /sucuri_cloudproxy_js/i.test(page)
}

const fetchBrandPageTextWithUserAgent = async (url, userAgent, fetchImpl = fetch) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
      signal: controller.signal,
    })
    const html = await response.text()

    if (response.ok) return html
    if (response.status === 307 && hasBrandPageChallengeSignal(html)) {
      return html
    }

    const error = new Error(`HTTP ${response.status} for ${url}`)
    error.status = response.status
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const createMarutAirBrandPageFetchText = ({
  fetchImpl = fetch,
} = {}) => async (url) => {
  try {
    return await fetchBrandPageTextWithUserAgent(url, PRIMARY_USER_AGENT, fetchImpl)
  } catch (error) {
    if (!isMarutAirFallbackableTransportError(error)) {
      throw error
    }

    return fetchBrandPageTextWithUserAgent(url, FALLBACK_USER_AGENT, fetchImpl)
  }
}

const defaultFetchBrandPageText = createMarutAirBrandPageFetchText()

export const hasJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /Jobs\s*\|\s*Marut Air Systems Pvt Ltd/i.test(page)
    && /info@marutair\.com/i.test(text)
    && /AHMEDABAD\s*,\s*India/i.test(text)
    && /(Sales Engineer|Full Stack Developer|HR Recruiter)/i.test(text)
}

export const hasVerifiedEmptyJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title[^>]*>\s*Jobs\s*\|\s*Marut Air\s*<\/title>/i.test(page)
    && /Our Job Opportunities/i.test(text)
    && /There are currently no open job opportunities/i.test(text)
    && /MARUT AIR SYSTEMS PRIVATE LIMITED/i.test(text)
    && !/<a[^>]+href=["'][^"']*\/jobs\/(?!apply\/)[^"']*-\d+\/?["']/i.test(page)
}

export const extractJobCards = (html) => {
  if (!hasJobsPageSignal(html)) {
    throw new Error('Expected verified Marut Air jobs page with public listings')
  }

  const cards = []

  for (const match of String(html ?? '').matchAll(/<a[^>]+href="([^"]*\/jobs\/(?!apply\/)[^"]*-\d+\/?)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, rawHref, blockHtml] = match
    const title = normalizeOptionalValue(blockHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    if (!title) continue

    const city = normalizeOptionalValue(blockHtml.match(/itemprop="addressLocality">([\s\S]*?)<\/span>/i)?.[1])
    const country = normalizeOptionalValue(blockHtml.match(/itemprop="addressCountry">([\s\S]*?)<\/span>/i)?.[1])
    const locationBits = normalizeLocation({ city, country })

    cards.push({
      title,
      detailUrl: buildAbsoluteUrl(rawHref),
      openingsLabel: stripTags(blockHtml.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1]),
      summary: stripTags(blockHtml.match(/<div[^>]*class="oe_empty[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]),
      department: normalizeOptionalValue(
        blockHtml.match(/title="Department"[\s\S]*?<span[^>]*class="fw-light"[^>]*>([\s\S]*?)<\/span>/i)?.[1],
      ),
      location: locationBits.location,
      city: locationBits.city,
      state: locationBits.state,
      country: locationBits.country,
      jobId: extractJobId(rawHref),
    })
  }

  if (cards.length === 0) {
    throw new Error('Expected verified Marut Air jobs page with public listings')
  }

  return cards
}

export const extractJobDetail = (detailHtml, listing) => {
  const html = String(detailHtml ?? '')
  const title = normalizeOptionalValue(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const applyUrl = buildAbsoluteUrl(
    html.match(/<a[^>]+href="([^"]*\/jobs\/apply\/[^"]+)"[^>]*>\s*Apply Now!?/i)?.[1],
  )

  if (
    !title
    || !normalizedTextEquals(title, listing.title)
    || !applyUrl
    || !/info@marutair\.com/i.test(html)
  ) {
    throw new Error('Expected verified Marut Air detail page with a matching title and first-party apply URL')
  }

  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .filter((paragraph) => !normalizedTextEquals(paragraph, listing.location))
    .filter((paragraph) => !normalizedTextEquals(paragraph, 'info@marutair.com'))

  const description = normalizeOptionalValue(paragraphs.join(' '))

  return {
    title: listing.title,
    company: COMPANY,
    department: listing.department,
    location: listing.location,
    city: listing.city,
    state: listing.state,
    country: listing.country,
    jobId: listing.jobId,
    requisitionId: listing.jobId,
    sourceUrl: listing.detailUrl,
    applyUrl,
    employmentType: null,
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

export const createMarutAirScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrandPageText = defaultFetchBrandPageText,
    maxJobs: overrideMaxJobs,
    now: overrideNow,
  } = {}) {
    let brandPageHtml

    try {
      brandPageHtml = await fetchText(BRAND_PAGE_URL)
    } catch (error) {
      if (!errorHasHttpStatus(error, 307)) throw error
      brandPageHtml = await fetchBrandPageText(BRAND_PAGE_URL)
    }

    if (!hasBrandPageSignal(brandPageHtml) && !hasBrandPageChallengeSignal(brandPageHtml)) {
      throw new Error('Marut Air brand page no longer exposes the verified first-party signals')
    }

    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)

    if (hasVerifiedEmptyJobsPageSignal(jobsPageHtml)) {
      return []
    }

    if (!hasJobsPageSignal(jobsPageHtml)) {
      throw new Error('Expected verified Marut Air jobs page with public listings')
    }

    const listings = extractJobCards(jobsPageHtml)
    const indiaListings = listings.filter((listing) => normalizedTextEquals(listing.country, 'India'))

    if (indiaListings.length === 0) {
      throw new Error('Expected verified Marut Air jobs page with India listings')
    }

    const limit = Number.isInteger(overrideMaxJobs) ? overrideMaxJobs : maxJobs
    const selectedListings = limit ? indiaListings.slice(0, limit) : indiaListings
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

export const run = async (options = {}) => createMarutAirScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Marut Air scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
