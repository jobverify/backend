import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://www.scaler.com'
export const CAREERS_URL = `${BASE_URL}/careers/`
export const SOURCE = 'scaler'
export const COMPANY = 'Scaler'

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
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|main|h[1-6]|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n+/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join(' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (value) => {
  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

const isJobDetailUrl = (value) => {
  if (!value) return false

  try {
    const parsed = new URL(value)
    return /(^|\.)scaler\.com$/i.test(parsed.hostname)
      && /^\/careers\/[^/]+\/?$/i.test(parsed.pathname)
      && !/^\/careers\/?$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

const getOpeningCardsSection = (html) => String(html ?? '').match(
  /<div class="opening__blocks__container">([\s\S]*?)<\/div>\s*<\/section>/i,
)?.[1] || String(html ?? '').match(
  /Job Openings([\s\S]*?)(?:<\/main>|<\/section>|$)/i,
)?.[1] || null

const getTextLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|main|h[1-6]|ul|ol)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const findLineValue = (lines, label) => {
  const matcher = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'i')

  for (const line of lines) {
    const match = matcher.exec(line)
    if (match) return normalizeWhitespace(match[1])
  }

  return null
}

const cleanLocation = (value) => normalizeWhitespace(String(value ?? '').split('|')[0])

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const primary = normalized
    .split('|')[0]
    .split('(')[0]
    .trim()

  return primary ? normalizeCity(primary) : null
}

const inferRemoteStatus = ({ workMode, location }) => {
  const combined = normalizeWhitespace(`${workMode || ''} ${location || ''}`) || ''

  if (/hybrid/i.test(combined)) return 'Hybrid'
  if (/remote/i.test(combined)) return 'Remote'
  if (/office|on-site|onsite|wfo/i.test(combined)) return 'On-site'

  return 'On-site'
}

const extractApplyUrl = (html, fallbackUrl = null) => {
  const match = String(html ?? '').match(
    /<a[^>]+href=(?:"([^"]+)"|'([^']+)'|([^>\s]+))[^>]*>\s*Apply Now\s*<\/a>/i,
  )

  return toAbsoluteUrl(match?.[1] || match?.[2] || match?.[3]) || fallbackUrl
}

const extractDescriptionHtml = (html) => {
  const page = String(html ?? '')
  const sectionsHtml = page.match(
    /<div class="job-desc-page__sections">([\s\S]*?)(?=<div[^>]*job-desc-page__job_overview|<\/main>)/i,
  )?.[1] || page.match(/<section\b[^>]*>([\s\S]*?)<\/section>/i)?.[1]

  if (!sectionsHtml) return null

  const descriptionHtml = sectionsHtml
    .replace(/<p>\s*<strong>\s*Job Title:\s*<\/strong>[\s\S]*?<\/p>/i, '')
    .replace(/<p>\s*<strong>\s*Location:\s*<\/strong>[\s\S]*?<\/p>/i, '')

  return descriptionHtml || null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const cardsSection = getOpeningCardsSection(page)

  return /<title>\s*Careers\s*\|\s*Scaler\s*<\/title>/i.test(page)
    && /Transform the tech world with Scaler\./i.test(page)
    && /Job Openings/i.test(page)
    && /href=["']\/careers\/[^/"'#?]+["']/i.test(cardsSection || '')
}

export const extractListings = (html) => {
  const cardsSection = getOpeningCardsSection(html)
  if (!cardsSection) return []

  const jobs = []
  const seen = new Set()

  for (const match of cardsSection.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const innerHtml = match[2]
    const title = normalizeWhitespace(innerHtml.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
      || normalizeWhitespace(
        stripTags(innerHtml)
          ?.replace(/^Posted\s+.+?\s+ago\s+/i, '')
          .replace(/\s+[A-Z][A-Za-z&/ ]+\s*-\s*[A-Z][A-Za-z ,()]+\s*-\s*[A-Za-z ]+$/i, ''),
      )
    const jobId = slugFromUrl(sourceUrl)

    if (!isJobDetailUrl(sourceUrl) || !title || !jobId || seen.has(sourceUrl)) continue

    seen.add(sourceUrl)
    jobs.push({
      title,
      company: COMPANY,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const lines = getTextLines(html)
  const title = normalizeWhitespace(
    String(html ?? '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ) || listing.title || null
  const department = normalizeWhitespace(
    String(html ?? '').match(/job-details--department[^>]*>\s*([\s\S]*?)\s*<\/div>/i)?.[1],
  ) || normalizeWhitespace(String(html ?? '').match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
  const location = cleanLocation(findLineValue(lines, 'Location'))
  const overviewLocation = normalizeWhitespace(
    String(html ?? '').match(/<li>\s*Location:\s*([\s\S]*?)<\/li>/i)?.[1],
  )
  const employmentType = normalizeWhitespace(
    String(html ?? '').match(/<li>\s*Job Type:\s*([\s\S]*?)<\/li>/i)?.[1],
  )
  const workMode = normalizeWhitespace(
    String(html ?? '').match(/<li>\s*Work:\s*([\s\S]*?)<\/li>/i)?.[1],
  )
  const resolvedLocation = location || overviewLocation
  const description = stripTags(extractDescriptionHtml(html))

  return {
    title,
    company: COMPANY,
    department,
    location: resolvedLocation,
    city: deriveCity(resolvedLocation),
    country: resolvedLocation ? 'India' : null,
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: extractApplyUrl(html, listing.applyUrl || listing.sourceUrl || null),
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    remoteStatus: inferRemoteStatus({ workMode, location: resolvedLocation }),
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

export const createScalerScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('verified Scaler careers surface no longer matches the official public careers page')
    }

    const listings = extractListings(careersHtml)
    if (listings.length === 0) {
      throw new Error('verified Scaler careers surface no longer exposes public same-domain job opening cards')
    }

    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        source: SOURCE,
        link: listing.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createScalerScraper().run(options)

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
