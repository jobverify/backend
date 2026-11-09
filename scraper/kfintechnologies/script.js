import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { KFIN_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = KFIN_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_ARCHIVE_URL = PROVIDER_METADATA.officialJobsArchiveUrl
export const VERIFIED_SAMPLE_JOB_URL = PROVIDER_METADATA.verifiedSampleJobUrl
export const VERIFIED_PUBLIC_JOB_COUNT = PROVIDER_METADATA.verifiedPublicJobCount
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const TRANSIENT_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'ERR_NAME_NOT_RESOLVED',
])

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const stripTags = (value) => normalizeOptionalValue(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const isTransientUpstreamError = (error) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    const code = typeof current.code === 'string' ? current.code : ''
    const message = String(current.message ?? current)

    if (
      TRANSIENT_ERROR_CODES.has(code)
      || /\bHTTP 5\d\d\b/i.test(message)
      || /\b(fetch failed|connect timeout|timed out|timeout|getaddrinfo|ENOTFOUND|EAI_AGAIN)\b/i.test(message)
    ) {
      return true
    }

    current = current.cause
  }

  return false
}

const buildDiscoveryOnlyEvidence = (now) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: CAREERS_URL,
    firstParty: true,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: normalizeScrapedAt(now()),
    reason: 'KFin Technologies verified careers page is currently unavailable; first-party job inventory cannot be verified.',
  })

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeExperience = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  return normalized
    .replace(/\bYrs\b\s*years\b/gi, 'years')
    .replace(/\bYrs\b/gi, 'years')
}

const extractCanonicalUrl = (html = '', baseUrl = CAREERS_URL) => {
  const page = String(html ?? '')
  const linkHref = page.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]
    || page.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i)?.[1]
  const ogUrl = page.match(/<meta\b[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]
  return toAbsoluteUrl(linkHref || ogUrl, baseUrl)
}

const stripKfinSuffix = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  return normalized
    .replace(/\s*-\s*KFin Technologies Private Limited\s*\|\s*KFintech$/i, '')
    .replace(/\s*\|\s*KFintech$/i, '')
    .trim()
}

const extractTitle = (html = '') => {
  const page = String(html ?? '')

  return stripKfinSuffix(
    page.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]
      || page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      || page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      || page.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1],
  )
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractLabeledValue = (html = '', label) => {
  const escapedLabel = escapeRegExp(label)
  const patterns = [
    new RegExp(`<p[^>]*>[\\s\\S]*?<span[^>]*>${escapedLabel}:?\\s*<\\/span>\\s*([\\s\\S]*?)<\\/p>`, 'i'),
    new RegExp(`<p[^>]*>\\s*<b[^>]*>${escapedLabel}:?<\\/b>\\s*([\\s\\S]*?)<\\/p>`, 'i'),
    new RegExp(`<li[^>]*>[\\s\\S]*?<span[^>]*>${escapedLabel}:?\\s*<\\/span>\\s*([\\s\\S]*?)<\\/li>`, 'i'),
    new RegExp(`<li[^>]*>\\s*<b[^>]*>${escapedLabel}:?<\\/b>\\s*([\\s\\S]*?)<\\/li>`, 'i'),
    new RegExp(`${escapedLabel}:\\s*([^<\\n\\r]+)`, 'i'),
  ]

  for (const pattern of patterns) {
    const value = stripTags(String(html ?? '').match(pattern)?.[1])
    if (value) return value
  }

  return null
}

const extractJobSlug = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const normalizeLocationBits = (value) => {
  const normalized = normalizeOptionalValue(value)
  const country = 'India'

  if (!normalized) {
    return {
      location: country,
      city: null,
      state: null,
      country,
    }
  }

  const rawParts = normalized.split(',').map((part) => normalizeOptionalValue(part)).filter(Boolean)
  const parts = rawParts.at(-1)?.toLowerCase() === 'india' ? rawParts.slice(0, -1) : rawParts
  const city = parts[0] ? normalizeCity(parts[0]) || parts[0] : null
  const state = parts.length > 1 ? parts.at(-1) : null

  return {
    location: [...parts, country].filter(Boolean).join(', '),
    city,
    state,
    country,
  }
}

const extractJobDescription = (html = '') => {
  const page = String(html ?? '')
  const match = page.match(
    /<div[^>]*class=["'][^"']*position-description[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<h[1-6][^>]*>\s*Apply for this Job/i,
  ) || page.match(
    /<div[^>]*class=["'][^"']*position-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ) || page.match(
    /<div[^>]*class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<h[1-6][^>]*>\s*Apply for this Job/i,
  ) || page.match(
    /<div[^>]*class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ) || page.match(
    /<p[^>]*>[\s\S]*?(?:<span[^>]*>|<b[^>]*>)Grade:\s*<\/(?:span|b)>\s*[^<]+<\/p>([\s\S]*?)<h[1-6][^>]*>\s*Apply for this Job/i,
  )

  const visibleDescription = stripTags(match?.[1])
  if (visibleDescription) return visibleDescription

  return normalizeOptionalValue(
    page.match(/<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1],
  )
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to KFin Technologies scraper')
  }

  return parsed.toISOString()
}

export const extractJobLinks = (html = '') => {
  const page = String(html ?? '')
  const links = []

  for (const match of page.matchAll(/href=["']([^"']*\/jobs\/[^"'#?\s<>]+\/?)["']/gi)) {
    const jobUrl = toAbsoluteUrl(match[1], JOBS_ARCHIVE_URL)
    if (!jobUrl) continue
    if (!/^https:\/\/www\.kfintech\.com\/jobs\/[a-z0-9-]+\/?$/i.test(jobUrl)) continue
    links.push(jobUrl.endsWith('/') ? jobUrl : `${jobUrl}/`)
  }

  return unique(links)
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const title = normalizeOptionalValue(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  const jobLinks = extractJobLinks(page)

  return title === 'Careers - KFin Technologies Private Limited | KFintech'
    && normalized.includes('Be the first to see new opportunities.')
    && normalized.includes('Join the Talent Network')
    && normalized.includes('Domestic Fund Services')
    && normalized.includes('IT')
    && normalized.includes('Non-Domestic Fund Services')
    && normalized.includes('No Jobs Available')
    && jobLinks.length > 0
}

export const hasOfficialJobDetailSignal = (html = '', expectedUrl) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const title = extractTitle(page)
  const canonicalUrl = extractCanonicalUrl(page, expectedUrl)

  return Boolean(title)
    && (!canonicalUrl || canonicalUrl === expectedUrl)
    && normalized.includes('Apply Now')
    && normalized.includes('Apply for this Job')
    && Boolean(extractLabeledValue(page, 'Experience'))
    && Boolean(extractLabeledValue(page, 'Skills/Designation'))
    && Boolean(extractLabeledValue(page, 'Location'))
}

export const extractJobFromDetailPage = (sourceUrl, html = '') => {
  const jobId = extractJobSlug(sourceUrl)
  const title = extractTitle(html)
  const skillsDesignation = extractLabeledValue(html, 'Skills/Designation')
  const locationBits = normalizeLocationBits(extractLabeledValue(html, 'Location'))

  if (!jobId || !title) {
    throw new Error(`KFin Technologies job detail page could not be normalized: ${sourceUrl}`)
  }

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location: locationBits.location,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: normalizeExperience(extractLabeledValue(html, 'Experience')),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: skillsDesignation ? [skillsDesignation] : [],
    postingDate: null,
    closingDate: null,
    jobDescription: extractJobDescription(html),
    remoteStatus: null,
  }
}

export const createKFinTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, maxJobs: overrideMaxJobs, now: overrideNow } = {}) {
    try {
      const careersHtml = await fetchText(CAREERS_URL)
      if (!hasOfficialCareersPageSignal(careersHtml)) {
        throw new Error('The verified KFin Technologies careers page no longer matches the trusted public surface')
      }

      const jobLinks = extractJobLinks(careersHtml)
      if (jobLinks.length === 0) {
        throw new Error('KFin Technologies careers page no longer exposes the verified first-party job detail links')
      }

      const limit = Number.isInteger(overrideMaxJobs) ? overrideMaxJobs : maxJobs
      const selectedLinks = limit ? jobLinks.slice(0, limit) : jobLinks
      const scrapedAt = normalizeScrapedAt((overrideNow || now)())
      const jobs = []

      for (const sourceUrl of selectedLinks) {
        const detailHtml = await fetchText(sourceUrl)
        if (!hasOfficialJobDetailSignal(detailHtml, sourceUrl)) {
          throw new Error(`KFin Technologies job detail page no longer matches the trusted public surface: ${sourceUrl}`)
        }

        jobs.push({
          ...extractJobFromDetailPage(sourceUrl, detailHtml),
          source: SOURCE,
          link: sourceUrl,
          scrapedAt,
        })
      }

      return jobs
    } catch (error) {
      if (isTransientUpstreamError(error)) return buildDiscoveryOnlyEvidence(overrideNow || now)
      throw error
    }
  },
})

export const run = async (options = {}) => createKFinTechnologiesScraper(options).run(options)

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
