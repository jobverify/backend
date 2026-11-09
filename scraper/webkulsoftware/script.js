import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { WEBKUL_SOFTWARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = WEBKUL_SOFTWARE_CATALOG.source
export const COMPANY = WEBKUL_SOFTWARE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = WEBKUL_SOFTWARE_CATALOG.officialBrandName
export const VERIFIED_ON = WEBKUL_SOFTWARE_CATALOG.verifiedOn
export const CAREERS_LANDING_URL = WEBKUL_SOFTWARE_CATALOG.careersLandingUrl
export const JOBS_URL = WEBKUL_SOFTWARE_CATALOG.jobsPageUrl
export const PROVIDER_METADATA = WEBKUL_SOFTWARE_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
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

const stripTags = (value) => normalizeWhitespace(value)

const toAbsoluteUrl = (value, baseUrl = JOBS_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const isOfficialWebkulUrl = (value) => {
  try {
    const { hostname } = new URL(String(value ?? ''))
    return hostname === 'webkul.com' || hostname === 'www.webkul.com'
  } catch {
    return false
  }
}

const extractJobIdFromUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = /\/jobs\/([^/?#]+)\/?/i.exec(normalized)
  return match ? match[1] : null
}

const extractJsonLdObjects = (html) => [...String(html ?? '').matchAll(
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
)]
  .map((match) => match[1]?.trim())
  .filter(Boolean)
  .map((raw) => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
  .flatMap((value) => (Array.isArray(value) ? value : [value]))
  .filter(Boolean)

const extractJobPosting = (html) =>
  extractJsonLdObjects(html).find((item) => String(item?.['@type'] ?? '').toLowerCase() === 'jobposting') || null

const extractDataVal = (html, className) => {
  const pattern = new RegExp(`class=["'][^"']*${className}[^"']*["'][^>]*data-val=["']([^"']+)["']`, 'i')
  const match = pattern.exec(String(html ?? ''))
  return match ? normalizeWhitespace(match[1]) : null
}

const extractDataAttribute = (html, attributeName) => {
  const pattern = new RegExp(`${attributeName}=["']([^"']+)["']`, 'i')
  const match = pattern.exec(String(html ?? ''))
  return match ? normalizeWhitespace(match[1]) : null
}

const extractPrimaryCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const firstSegment = normalized.split(/[(/]/)[0]?.trim()
  return firstSegment ? normalizeCity(firstSegment) || firstSegment : null
}

const normalizeTitle = (value) => normalizeWhitespace(value)?.toLowerCase() || null

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  return /<h1>\s*Open Positions\s*<\/h1>/i.test(page)
    && /class=["'][^"']*\bop-block\b[^"']*["']/i.test(page)
    && /https:\/\/webkul\.com\/jobs\//i.test(page)
}

export const hasOfficialNoListingsShellSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*Jobs\s*-\s*Webkul Software\s*<\/title>/i.test(page)
    && /<h1>\s*Open Positions\s*<\/h1>/i.test(page)
    && /class=["'][^"']*\bwk-open-position\b[^"']*["']/i.test(page)
    && /class=["'][^"']*\bwk-openjobs-tabs\b[^"']*["']/i.test(page)
    && /class=["'][^"']*\bjob-group\b[^"']*["']/i.test(page)
    && text.includes('Here is the list of open positions that we are currently hiring.')
    && text.includes('You can follow us on Linkedin to recieve job updates.')
    && text.includes("Didn't find relevant opportunity?")
    && !/class=["'][^"']*\bop-block\b[^"']*["']/i.test(page)
}

export const extractJobCards = (html) => [...String(html ?? '').matchAll(
  /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*\bop-block\b[^"']*["'][^>]*>\s*<h5[^>]*class=["'][^"']*\bop-name\b[^"']*["'][^>]*>([\s\S]*?)<\/h5>\s*<div[^>]*class=["'][^"']*\bop-info\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/a>/gi,
)]
  .map((match) => {
    const detailUrl = toAbsoluteUrl(match[1])
    const title = stripTags(match[2])
    const info = match[3]
    const experienceRequired = stripTags(/Experience:\s*([\s\S]*?)<\/span>/i.exec(info)?.[1])
    const openings = stripTags(/Open Position:\s*([\s\S]*?)<\/span>/i.exec(info)?.[1])

    if (!detailUrl || !title || !experienceRequired || !openings || !isOfficialWebkulUrl(detailUrl)) {
      return null
    }

    return {
      title,
      detailUrl,
      experienceRequired,
      openings,
      jobId: extractJobIdFromUrl(detailUrl),
    }
  })
  .filter(Boolean)

export const hasOfficialJobDetailSignal = (html, expectedTitle) => {
  const page = String(html ?? '')
  const normalizedTitle = normalizeTitle(expectedTitle)
  const detailTitle = normalizeTitle(stripTags(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(page)?.[1]))
  const hasRecognizedApplyCta = /Apply By Github/i.test(page) || /Apply Now/i.test(page)

  return normalizedTitle
    && detailTitle === normalizedTitle
    && /Webkul Software/i.test(page)
    && hasRecognizedApplyCta
    && (/class=["'][^"']*job-location[^"']*["'][^>]*data-val=/i.test(page) || /Job Location/i.test(page))
}

const extractJobDescription = (html, jobPosting) => {
  const fromJsonLd = stripTags(jobPosting?.description)
  if (fromJsonLd) return fromJsonLd

  const paragraphMatch = /<div[^>]*class=["'][^"']*\bdetails\b[^"']*["'][^>]*>\s*<p>([\s\S]*?)<\/p>/i.exec(String(html ?? ''))
  return stripTags(paragraphMatch?.[1])
}

const extractJobFromDetailPage = (html, card) => {
  const jobPosting = extractJobPosting(html)
  const location = extractDataVal(html, 'job-location')
    || normalizeWhitespace(jobPosting?.jobLocation?.address?.addressLocality)
  const experienceRequired = extractDataVal(html, 'exp') || card.experienceRequired
  const openings = extractDataVal(html, 'count') || card.openings
  const minimumQualification = extractDataVal(html, 'job-education')
  const department = extractDataAttribute(html, 'data-category')
  const employmentType = normalizeWhitespace(jobPosting?.employmentType)
  const postingDate = normalizeWhitespace(jobPosting?.datePosted)
  const closingDate = normalizeWhitespace(jobPosting?.validThrough)
  const title = normalizeWhitespace(jobPosting?.title) || card.title

  return {
    title,
    company: COMPANY,
    department,
    location,
    city: extractPrimaryCity(location),
    country: 'India',
    jobId: card.jobId,
    requisitionId: card.jobId,
    sourceUrl: card.detailUrl,
    applyUrl: card.detailUrl,
    employmentType,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate,
    jobDescription: extractJobDescription(html, jobPosting),
    openings,
    remoteStatus: null,
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

export const createWebkulSoftwareScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const jobsHtml = await fetchText(JOBS_URL)

    if (hasOfficialNoListingsShellSignal(jobsHtml)) {
      return []
    }

    if (!hasOfficialJobsPageSignal(jobsHtml)) {
      throw new Error('Webkul Software verified first-party jobs surface no longer matches the public contract')
    }

    const cards = extractJobCards(jobsHtml)
    if (cards.length === 0) {
      throw new Error('Webkul Software verified first-party jobs surface no longer exposes the expected job cards')
    }

    const jobs = []

    for (const card of cards) {
      const detailHtml = await fetchText(card.detailUrl)

      if (!hasOfficialJobDetailSignal(detailHtml, card.title)) {
        throw new Error(`Webkul Software verified detail-page contract changed for ${card.title}`)
      }

      jobs.push({
        ...extractJobFromDetailPage(detailHtml, card),
        source: SOURCE,
        link: card.detailUrl,
        scrapedAt: now(),
      })

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createWebkulSoftwareScraper(options).run(options)

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
