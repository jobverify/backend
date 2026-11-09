import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { ALPHAGREP_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = ALPHAGREP_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_HOME_URL = PROVIDER_METADATA.companyCareerPage
export const CAREER_OPPORTUNITY_BASE_URL = PROVIDER_METADATA.careerOpportunityBaseUrl
export const VERIFIED_INDIA_JOB_URL = PROVIDER_METADATA.verifiedIndiaJobUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const KNOWN_INDIA_LISTING_LOCATIONS = new Set(['india', 'mumbai', 'bangalore', 'chennai', 'hyderabad', 'delhi'])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl = CAREERS_HOME_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => String(value ?? '').replace(/\/$/, '')

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const extractJobIdFromUrl = (value) =>
  String(value ?? '').match(/[?&]jid=(\d+)/i)?.[1] || null

const extractCityHintFromTitle = (title) => {
  const match = normalizeWhitespace(title)?.match(/-\s*([A-Za-z][A-Za-z ]+)$/)
  const candidate = normalizeWhitespace(match?.[1])

  if (!candidate) return null

  return KNOWN_INDIA_LISTING_LOCATIONS.has(candidate.toLowerCase()) && candidate.toLowerCase() !== 'india'
    ? candidate
    : null
}

const normalizeListingLocation = (title, rawLocation) => {
  const locationLabel = normalizeWhitespace(rawLocation)
  if (!locationLabel) return null

  const normalizedLocationLabel = locationLabel.toLowerCase()
  if (!KNOWN_INDIA_LISTING_LOCATIONS.has(normalizedLocationLabel)) return null

  if (normalizedLocationLabel === 'india') {
    const city = extractCityHintFromTitle(title)

    return {
      location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
      city: city || null,
      country: COUNTRY_FILTER,
    }
  }

  return {
    location: `${locationLabel}, ${COUNTRY_FILTER}`,
    city: locationLabel,
    country: COUNTRY_FILTER,
  }
}

const extractJobDetailBlock = (html) =>
  String(html ?? '').match(/<div[^>]+class=["'][^"']*jobDet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || null

const extractContentBlock = (html) =>
  String(html ?? '').match(/<div[^>]+class=["'][^"']*contentJD[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || null

const extractDetailTitle = (html) => {
  const block = extractJobDetailBlock(html)
  return normalizeWhitespace(block?.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
}

const extractDepartment = (html) => {
  const block = extractJobDetailBlock(html)
  return normalizeWhitespace(
    block?.match(/<h6(?![^>]*class=["'][^"']*location[^"']*["'])[^>]*>([\s\S]*?)<\/h6>/i)?.[1]
      || block?.match(/<p\b[^>]*class=["'][^"']*\beut-h6\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1],
  )
}

const extractRawDetailLocation = (html) => {
  const block = extractJobDetailBlock(html)
  return normalizeWhitespace(
    block?.match(/<h6[^>]*class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/h6>/i)?.[1]
      || block?.match(/<p\b[^>]*class=["'][^"']*\blocation\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1],
  )
}

const hasInlineApplyForm = (html) => {
  const page = String(html ?? '')

  return /id=["']jobApply["']/i.test(page)
    && /<form\b[^>]*enctype=["']multipart\/form-data["']/i.test(page)
    && /name=["']resume["']/i.test(page)
    && /Submit Application/i.test(page)
}

export const extractCareersUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]+href=['"]([^'"]+)['"]/gi)) {
    const url = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (url === CAREERS_HOME_URL) return url
  }

  return null
}

const hasCanonicalUrl = (html, expectedUrl, baseUrl) => {
  for (const match of String(html ?? '').matchAll(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/gi)) {
    const canonicalUrl = toAbsoluteUrl(match[1], baseUrl)
    if (normalizeComparableUrl(canonicalUrl) === normalizeComparableUrl(expectedUrl)) return true
  }

  return false
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return extractTitle(page) === 'AlphaGrep | Global Quantitative Trading, Market Making & Investment Firm'
    && hasCanonicalUrl(page, HOMEPAGE_URL, HOMEPAGE_URL)
    && extractCareersUrl(page) === CAREERS_HOME_URL
}

const extractListingCandidates = (html) => {
  const patterns = [
    /<li>\s*<a\b[^>]+href=['"]([^'"]*career-opportunity\/?\?jid=\d+)['"][^>]*>\s*<div>\s*<p\b[^>]*class=['"][^'"]*\beut-job-title\b[^'"]*['"][^>]*>([\s\S]*?)<\/p>\s*<\/div>\s*<span[^>]+class=['"]jobLocation['"]>([\s\S]*?)<strong\b/gi,
    /<a\b[^>]+href=['"]([^'"]*career-opportunity\/?\?jid=\d+)['"][^>]*>\s*<li>\s*<div>\s*<h5[^>]*>([\s\S]*?)<\/h5>\s*<\/div>\s*<span[^>]+class=['"]jobLocation['"]>([\s\S]*?)<strong\b/gi,
    /<li>\s*<a\b[^>]+href=['"]([^'"]*career-opportunity\/?\?jid=\d+)['"][^>]*>\s*<div>\s*<h5[^>]*>([\s\S]*?)<\/h5>\s*<\/div>\s*<span[^>]+class=['"]jobLocation['"]>([\s\S]*?)<strong\b/gi,
  ]

  const listings = []
  for (const pattern of patterns) {
    for (const match of String(html ?? '').matchAll(pattern)) {
      listings.push({
        title: normalizeWhitespace(match[2]),
        rawLocation: normalizeWhitespace(match[3]),
        sourceUrl: toAbsoluteUrl(match[1], CAREERS_HOME_URL),
      })
    }
  }

  return listings.filter((listing) => listing.title && listing.rawLocation && listing.sourceUrl)
}

export const extractListingJobs = (html) =>
  extractListingCandidates(html)
    .map((listing) => {
      const normalizedLocation = normalizeListingLocation(listing.title, listing.rawLocation)
      if (!normalizedLocation) return null

      const jobId = extractJobIdFromUrl(listing.sourceUrl)
      if (!jobId) return null

      return {
        title: listing.title,
        location: normalizedLocation.location,
        city: normalizedLocation.city,
        country: normalizedLocation.country,
        jobId,
        requisitionId: jobId,
        sourceUrl: listing.sourceUrl,
        applyUrl: `${listing.sourceUrl}#jobApply`,
        employmentType: null,
        postingDate: null,
        closingDate: null,
        department: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const listings = extractListingJobs(page)

  return extractTitle(page) === 'Quantitative Trading Careers | Quant Research & Trading Jobs at AlphaGrep'
    && hasCanonicalUrl(page, CAREERS_HOME_URL, CAREERS_HOME_URL)
    && normalized.includes('Join our Team')
    && normalized.includes('Find your next role at Alphagrep')
    && normalized.includes('Apply for open positions at our offices in')
    && /search by job title/i.test(page)
    && listings.length > 0
}

export const hasOfficialJobDetailSignal = (html, expectedListing = null) => {
  const page = String(html ?? '')
  const detailTitle = extractDetailTitle(page)
  const rawLocation = extractRawDetailLocation(page)
  const detailBlock = extractJobDetailBlock(page) || ''
  const description = normalizeWhitespace(extractContentBlock(page)) || ''
  const titleTokens = normalizeWhitespace(expectedListing?.title)?.match(/[A-Za-z]{5,}/g) || []
  const hasClientRenderedDetail = !detailTitle
    && (!rawLocation || rawLocation === 'AlphaGrep')
    && Boolean(expectedListing?.jobId)
    && /<p>\s*Loading…\s*<\/p>/i.test(detailBlock)
    && /<p[^>]*class=["']location["'][^>]*>\s*AlphaGrep\s*<\/p>/i.test(detailBlock)
    && description.length >= 200
    && /\bAlphaGrep\b/i.test(description)
    && titleTokens.some((token) => description.toLowerCase().includes(token.toLowerCase()))

  return extractTitle(page) === 'Career Opportunity - AlphaGrep'
    && hasCanonicalUrl(page, CAREER_OPPORTUNITY_BASE_URL, CAREER_OPPORTUNITY_BASE_URL)
    && hasInlineApplyForm(page)
    && ((Boolean(extractDepartment(page))
      && Boolean(detailTitle)
      && Boolean(rawLocation)
      && (!expectedListing?.title || detailTitle === expectedListing.title))
      || hasClientRenderedDetail)
}

const inferLocationFromDetail = (title, rawLocation) => {
  const normalized = normalizeWhitespace(rawLocation)
  if (!normalized) return { location: COUNTRY_FILTER, city: null, country: COUNTRY_FILTER }

  const lower = normalized.toLowerCase()
  if (lower.endsWith(', india')) {
    const cityCandidate = normalizeWhitespace(normalized.split(',').slice(0, -1).pop())
    const city = cityCandidate && cityCandidate.toLowerCase().includes('alphagrep')
      ? null
      : cityCandidate

    return {
      location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
      city: city || null,
      country: COUNTRY_FILTER,
    }
  }

  if (lower.includes('india, ')) {
    const city = normalizeWhitespace(normalized.split(',').pop())

    return {
      location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
      city: city || null,
      country: COUNTRY_FILTER,
    }
  }

  if (lower.includes('india - ')) {
    const city = normalizeWhitespace(normalized.split('-').pop()?.split(',')[0])

    return {
      location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
      city: city || null,
      country: COUNTRY_FILTER,
    }
  }

  const cityHint = extractCityHintFromTitle(title)
  return {
    location: cityHint ? `${cityHint}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
    city: cityHint || null,
    country: COUNTRY_FILTER,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const title = extractDetailTitle(page) || listing.title || null
  const rawLocation = extractRawDetailLocation(page)
  const detailLocation = inferLocationFromDetail(title, rawLocation)
  const sourceUrl = listing.sourceUrl || VERIFIED_INDIA_JOB_URL

  return {
    title,
    company: COMPANY_NAME,
    department: extractDepartment(page) || listing.department || null,
    location: listing.location || detailLocation.location,
    city: listing.city ?? detailLocation.city,
    country: COUNTRY_FILTER,
    jobId: listing.jobId || extractJobIdFromUrl(sourceUrl),
    requisitionId: listing.requisitionId || listing.jobId || extractJobIdFromUrl(sourceUrl),
    sourceUrl,
    applyUrl: listing.applyUrl || `${sourceUrl}#jobApply`,
    employmentType: listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: listing.postingDate || null,
    closingDate: listing.closingDate || null,
    jobDescription: normalizeWhitespace(extractContentBlock(page)) || listing.jobDescription || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createAlphaGrepScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())

    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('AlphaGrep verified homepage handoff no longer matches the trusted public surface')
    }

    if (extractCareersUrl(homepageHtml) !== CAREERS_HOME_URL) {
      throw new Error('AlphaGrep verified homepage handoff no longer points to the trusted careers route')
    }

    const careersHtml = await fetchText(CAREERS_HOME_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('AlphaGrep verified careers page no longer matches the trusted public surface')
    }

    const listings = extractListingJobs(careersHtml)
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const detailHtmlByUrl = {}

    await Promise.all(selectedListings.map(async (listing) => {
      detailHtmlByUrl[listing.sourceUrl] = await fetchText(listing.sourceUrl)
    }))

    return selectedListings.map((listing) => {
      const detailHtml = detailHtmlByUrl[listing.sourceUrl]
      if (!hasOfficialJobDetailSignal(detailHtml, listing)) {
        throw new Error('AlphaGrep verified detail page no longer matches the trusted public surface')
      }

      const job = extractJobDetail(detailHtml, listing)

      return {
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }
    })
  },
})

export const run = async (options = {}) => createAlphaGrepScraper().run(options)

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
