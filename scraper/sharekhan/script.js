import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import SHAREKHAN_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SHAREKHAN_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LISTING_TABLE_URL = PROVIDER_METADATA.listingTableUrl
export const VERIFIED_SAMPLE_JOB_URL = PROVIDER_METADATA.verifiedSampleJobUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const normalizeDetailUrl = (value) => {
  const url = toAbsoluteUrl(value)
  if (!url) return null

  try {
    const parsed = new URL(url)
    const normalizedHost = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPath = parsed.pathname.replace(/\/+$/, '')

    if (normalizedHost !== 'sharekhan.com') return null
    if (!normalizedPath.startsWith('/careers/job-details/')) return null

    return `https://www.sharekhan.com${normalizedPath}`
  } catch {
    return null
  }
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/yrs?/i.test(normalized)) return normalized
  if (/^\d+$/.test(normalized)) return `${normalized} years`
  return normalized
}

const extractJobDescription = (html = '') => {
  const page = String(html ?? '')
  const directResponsibilitiesMatch = page.match(
    /<p><strong>\s*(?:<span[^>]*>)?Direct Responsibilities(?:<\/span>)?\s*<\/strong><\/p>[\s\S]*?<ul>([\s\S]*?)<\/ul>/i,
  )
  const modernResponsibilitiesMatch = page.match(
    /Direct Responsibilities[\s\S]*?<\/ul>\s*<div>\s*<ul>([\s\S]*?)<\/ul>/i,
  )
  const listOnlyResponsibilitiesMatch = page.match(
    /<h3[^>]+class=["'][^"']*JobTitle[^"']*["'][^>]*>[\s\S]*?<\/h3>\s*<hr[^>]*>\s*<ul>([\s\S]*?)<\/ul>/i,
  )
  const listHtml =
    directResponsibilitiesMatch?.[1]
    || modernResponsibilitiesMatch?.[1]
    || listOnlyResponsibilitiesMatch?.[1]

  if (!listHtml) return null

  const items = Array.from(listHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((item) => stripTags(item[1]))
    .map((item) => item?.replace(/^[•\u2022]\s*/, '') || item)
    .filter(Boolean)

  return items[0] ?? null
}

const extractDetailTitle = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(/<h3[^>]+class=["'][^"']*JobTitle[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1],
  )

const extractJobId = (url) => {
  const slug = normalizeWhitespace(url)?.split('/').filter(Boolean).pop() ?? null
  const match = slug?.match(/-(\d+)$/)
  return match?.[1] ?? null
}

export const extractListingRows = (html = '') => {
  const rows = []
  const rowPattern = /<tr>([\s\S]*?)<\/tr>/gi

  for (const match of String(html ?? '').matchAll(rowPattern)) {
    const cells = Array.from(match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi))
      .map((cell) => cell[1])

    if (cells.length < 5) continue

    const title = normalizeWhitespace(cells[0])
    const department = normalizeWhitespace(cells[1])
    const location = normalizeWhitespace(cells[2])
    const experienceRequired = normalizeExperience(cells[3])
    const detailUrl = normalizeDetailUrl(
      cells[4].match(/href=["']([^"']+)["']/i)?.[1],
    )

    if (!title && !department && !location && !experienceRequired && !detailUrl) continue
    if (!title || !detailUrl) {
      throw new Error('Sharekhan verified first-party detail links no longer match the trusted careers table')
    }

    rows.push({
      title,
      department,
      location,
      experienceRequired,
      detailUrl,
    })
  }

  return rows
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''
  const rows = extractListingRows(page)
  const titles = new Set(rows.map((row) => row.title))

  return /<title>\s*Explore Career Opportunities at Mirae Asset Sharekhan\s*<\/title>/i.test(page)
    && text.includes('Careers')
    && text.includes('View Details')
    && page.includes('mailto:careers@sharekhan.com')
    && titles.has('Senior Manager - Campaign Management')
    && titles.has('Manager Digital Marketing')
    && titles.has('UI/UX Designer')
}

export const extractJobsFromPages = (
  careersHtml,
  detailPages,
  { scrapedAt = new Date().toISOString() } = {},
) => extractListingRows(careersHtml).map((row) => {
  const detailHtml = detailPages[row.detailUrl]
  const detailTitle = extractDetailTitle(detailHtml)
  const jobDescription = extractJobDescription(detailHtml)
  const jobId = extractJobId(row.detailUrl)

  if (!detailHtml || !String(detailHtml).includes('Job Details') || !String(detailHtml).includes('Applying for the Job')) {
    throw new Error('Sharekhan verified first-party detail page contract no longer matches the trusted jobs surface')
  }

  if (!detailTitle || detailTitle !== row.title || !jobDescription || !jobId) {
    throw new Error('Sharekhan verified first-party detail page contract no longer matches the trusted jobs surface')
  }

  return {
    title: row.title,
    company: COMPANY,
    department: row.department,
    location: row.location ? `${row.location}, India` : 'India',
    city: normalizeCity(row.location),
    country: 'India',
    experienceRequired: row.experienceRequired,
    sourceUrl: row.detailUrl,
    applyUrl: row.detailUrl,
    link: row.detailUrl,
    source: SOURCE,
    jobId,
    requisitionId: jobId,
    jobDescription,
    scrapedAt,
  }
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'sharekhan-html',
  timeoutMs: 15000,
})

export const createSharekhanScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Sharekhan verified first-party careers page no longer matches the trusted jobs surface')
    }

    const detailPages = {}
    for (const row of extractListingRows(careersHtml)) {
      detailPages[row.detailUrl] = await fetchText(row.detailUrl)
    }

    return extractJobsFromPages(careersHtml, detailPages, {
      scrapedAt: now(),
    })
  },
})

export const run = async (options = {}) => createSharekhanScraper(options).run(options)

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
