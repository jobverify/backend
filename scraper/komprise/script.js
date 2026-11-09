import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import {
  KOMPRISE_CATALOG,
  VERIFIED_JOB_DETAIL_URLS as VERIFIED_JOB_DETAIL_URLS_CONST,
} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KOMPRISE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SITEMAP_INDEX_URL = PROVIDER_METADATA.sitemapIndexUrl
export const JOB_LISTING_SITEMAP_URL = PROVIDER_METADATA.jobListingSitemapUrl
export { VERIFIED_JOB_DETAIL_URLS_CONST as VERIFIED_JOB_DETAIL_URLS }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const KNOWN_INDIA_LOCATION_PATTERN = /\b(?:bangalore|bengaluru|gurgaon|gurugram|mumbai|pune|hyderabad|chennai|kolkata|delhi|noida)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&hellip;/gi, '...')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const extractMetaContent = (html = '', attribute) => {
  const match = String(html ?? '').match(
    new RegExp(`<meta\\b[^>]*property=["']${attribute}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i'),
  )

  return normalizeWhitespace(match?.[1]) || null
}

const extractFallbackTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null)

const normalizeJobTitle = (value) => normalizeWhitespace(value)
  ?.replace(/^Komprise\s+/i, '')
  ?.replace(/\s*[-–]\s*Komprise$/i, '')
  ?.trim() || null

const extractGoogleMapLocation = (html = '') => normalizeWhitespace(
  String(html ?? '').match(
    /<a[^>]+class=["'][^"']*google_map_link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
  )?.[1],
)

const extractLocationFromDescription = (description = '') =>
  normalizeWhitespace(description.match(/Location:\s*([^|]+?)\s*(?:\||$)/i)?.[1] || null)

const extractEmploymentTypeFromDescription = (description = '') =>
  normalizeWhitespace(
    description.match(/Employment Type:\s*([^|]+?)(?:\s+Company Overview:|\||$)/i)?.[1] || null,
  )

const extractApplyUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a[^>]+class=["'][^"']*job_application_email[^"']*["'][^>]+href=["']([^"']+)["']/i,
  )
  const fallback = String(html ?? '').match(/href=["'](mailto:(?:india|us)_careers@komprise\.com[^"']*)["']/i)
  return normalizeWhitespace(match?.[1] || fallback?.[1]) || null
}

const extractJobId = (html = '') => (
  String(html ?? '').match(/"postId":"(\d+)"/i)?.[1]
  || String(html ?? '').match(/[?&]p=(\d+)/i)?.[1]
  || null
)

const normalizePostingDate = (value) => {
  const parsed = new Date(String(value ?? ''))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const resolveIndiaLocation = (rawLocation, applyUrl) => {
  const location = normalizeWhitespace(rawLocation)
  const email = normalizeWhitespace(applyUrl)?.toLowerCase() || ''

  if (email.includes('us_careers@komprise.com')) return null
  if (location && /\b(?:usa|united states)\b/i.test(location)) return null

  const rawCity = location?.split(',')[0] || location
  const city = /\bbengalaru\b/i.test(rawCity) ? 'Bengaluru' : normalizeCity(rawCity)
  const isIndiaRole = email.includes('india_careers@komprise.com')
    || /\bindia\b/i.test(location || '')
    || KNOWN_INDIA_LOCATION_PATTERN.test(location || '')

  if (!isIndiaRole) return null

  return {
    city: city || null,
    location: city ? `${city}, India` : 'India',
    country: 'India',
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*(?:@|at)\s*Komprise\b[^<]*<\/title>/i.test(page)
    && /\bCAREERS @ KOMPRISE\b/i.test(page)
    && /\bOpen Positions\b/i.test(page)
    && /job_manager_ajax_filters/i.test(page)
    && /wp-job-manager/i.test(page)
  }

export const hasJobListingSitemapSignal = (xml = '') => {
  const entries = extractSitemapEntries(xml)
  return /<urlset\b/i.test(String(xml ?? ''))
    && entries.length > 0
    && new Set(entries.map((entry) => entry.url)).size === entries.length
    && entries.every(({ url, lastmod }) => {
      try {
        const parsed = new URL(url)
        return parsed.origin === 'https://www.komprise.com'
          && /^\/job\/[^/]+\/$/.test(parsed.pathname)
          && !Number.isNaN(Date.parse(lastmod))
      } catch {
        return false
      }
    })
}

export const extractSitemapEntries = (xml = '') =>
  [...String(xml ?? '').matchAll(/<url>([\s\S]*?)<\/url>/gi)]
    .map((match) => {
      const entry = match[1]
      return {
        url: normalizeWhitespace(entry.match(/<loc>([^<]+)<\/loc>/i)?.[1]),
        lastmod: normalizeWhitespace(entry.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1]),
      }
    })
    .filter((entry) => entry.url && entry.lastmod)

export const extractJobFromDetailPage = ({ url, lastmod, html } = {}) => {
  const sourceUrl = normalizeWhitespace(url)
  const rawHtml = String(html ?? '')
  const description = extractMetaContent(rawHtml, 'og:description') || ''
  const title = normalizeJobTitle(
    extractMetaContent(rawHtml, 'og:title') || extractFallbackTitle(rawHtml),
  )
  const applyUrl = extractApplyUrl(rawHtml)
  const locationBits = resolveIndiaLocation(
    extractLocationFromDescription(description) || extractGoogleMapLocation(rawHtml),
    applyUrl,
  )

  if (!title || !sourceUrl || !applyUrl || !locationBits) return null

  const jobId = extractJobId(rawHtml)
  if (!jobId) {
    throw new Error('Komprise verified WP Job Manager detail page changed materially')
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location: locationBits.location,
    city: locationBits.city,
    country: locationBits.country,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: extractEmploymentTypeFromDescription(description),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizePostingDate(lastmod),
    closingDate: null,
    jobDescription: normalizeWhitespace(description) || stripHtml(rawHtml),
    remoteStatus: null,
  }
}

export const createKompriseScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    const read = async url => {
      signal?.throwIfAborted()
      const html = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const careersHtml = await read(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Komprise verified careers page no longer matches the known first-party surface')
    }

    const sitemapXml = await read(JOB_LISTING_SITEMAP_URL)
    if (!hasJobListingSitemapSignal(sitemapXml)) {
      throw new Error('Komprise verified job listing sitemap no longer matches the known public jobs surface')
    }

    const entries = extractSitemapEntries(sitemapXml)
    const selectedEntries = Number.isInteger(maxJobs) && maxJobs > 0
      ? entries.slice(0, maxJobs)
      : entries

    const jobs = (await Promise.all(selectedEntries.map(async (entry) => {
      const html = await read(entry.url)
      const job = extractJobFromDetailPage({ ...entry, html })

      if (!job) return null

      return {
        ...job,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt: now(),
      }
    }))).filter(Boolean)

    return jobs
  },
})

export const run = async (options = {}) => createKompriseScraper().run(options)

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
