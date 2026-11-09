import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ONEADVANCED_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ONEADVANCED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SEARCH_PAGE_URL = PROVIDER_METADATA.searchPageUrl

export const ICIMS_USER_AGENT = 'Mozilla/5.0'

const STATE_CODE_MAP = {
  KA: 'Karnataka',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|dt|dd|h[1-6]|li|main|p|section|span|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractFirst = (pattern, value) => pattern.exec(String(value ?? ''))?.[1] ?? null

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': ICIMS_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const toAbsoluteUrl = (value, baseUrl = SEARCH_PAGE_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const parseIcimsLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  const codedMatch = normalized?.match(/^IN-([A-Z]{2})-([A-Za-z -]+)$/)

  if (codedMatch) {
    const [, stateCode, city] = codedMatch
    const state = STATE_CODE_MAP[stateCode] || stateCode
    return {
      location: `${city}, ${state}, India`,
      city,
      country: 'India',
    }
  }

  if (/India/i.test(normalized ?? '')) {
    const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
    return {
      location: normalized,
      city: parts[0] || null,
      country: 'India',
    }
  }

  return {
    location: normalized,
    city: null,
    country: null,
  }
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  return /OneAdvanced Careers/i.test(rawHtml)
    && /Power the world of work with us/i.test(rawHtml)
    && /careers-oneadvanced\.icims\.com/i.test(rawHtml)
}

export const hasOfficialSearchPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  return /iCIMS/i.test(rawHtml)
    && /container-fluid iCIMS_JobsTable/i.test(rawHtml)
    && /Job Locations/i.test(rawHtml)
}

export const extractJobListings = (html = '') => {
  const rows = [...String(html ?? '').matchAll(
    /<li[^>]*class=["'][^"']*iCIMS_JobCardItem[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi,
  )]

  return rows.map((match) => {
    const row = match[1]
    const sourceUrl = toAbsoluteUrl(extractFirst(/<a[^>]+href=["']([^"']+\/jobs\/\d+\/[^"']+\/job\?in_iframe=1)["']/i, row))
    const title = stripTags(extractFirst(/<h3[^>]*>([\s\S]*?)<\/h3>/i, row))
    const rawLocation = stripTags(
      extractFirst(/field-label">Job Locations<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const department = stripTags(
      extractFirst(/<dt[^>]*>\s*Category\s*<\/dt>\s*<dd[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const jobId = stripTags(
      extractFirst(/<dt[^>]*>\s*ID\s*<\/dt>\s*<dd[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const postingDate = toIsoDate(extractFirst(/title=["']([^"']+)["']/i, row))
    const { location, city, country } = parseIcimsLocation(rawLocation)

    if (!sourceUrl || !title || !jobId || country !== 'India') return null

    return {
      title,
      company: COMPANY,
      department,
      location,
      city,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      requiredSkills: [],
      postingDate,
      jobDescription: stripTags(extractFirst(/<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i, row)),
    }
  }).filter(Boolean)
}

export const extractJobDetail = (html = '', listing = {}) => {
  const title = stripTags(extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html)) || listing.title
  const rawLocation = stripTags(
    extractFirst(/Job Locations<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i, html),
  ) || listing.location
  const category = stripTags(
    extractFirst(/Category<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i, html),
  ) || listing.department
  const jobId = stripTags(
    extractFirst(/ID<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i, html),
  ) || listing.jobId
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<a[^>]+title=["']Apply for this job online["'][^>]+href=["']([^"']+)["']/i, html),
    listing.sourceUrl,
  ) || listing.sourceUrl

  const sections = ['Join OneAdvanced', 'What You Will Do', 'What You Will Have']
    .map((label) => stripTags(
      extractFirst(new RegExp(`<h2[^>]*>\\s*${escapeRegex(label)}\\s*<\\/h2>([\\s\\S]*?)(?:<h2|$)`, 'i'), html),
    ))
    .filter(Boolean)
  const skillsSection = extractFirst(/<h2[^>]*>\s*What You Will Have\s*<\/h2>([\s\S]*?)(?:<h2|$)/i, html)
  const requiredSkills = [...String(skillsSection ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  const { location, city, country } = parseIcimsLocation(rawLocation)
  const jobDescription = normalizeWhitespace(
    sections.join(' ').replace(/\bApply for this job online\b/gi, ''),
  ) || listing.jobDescription || null

  return {
    title,
    company: COMPANY,
    department: category,
    location,
    city,
    country: country || listing.country || 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: listing.sourceUrl,
    applyUrl,
    employmentType: null,
    requiredSkills,
    postingDate: listing.postingDate || null,
    jobDescription,
  }
}

const getNextPageUrl = (html = '', currentUrl = SEARCH_PAGE_URL) => {
  const nextHref = extractFirst(/<a[^>]+(?:rel=["']next["']|aria-label=["']Next["'])[^>]+href=["']([^"']+)["']/i, html)
  return nextHref ? toAbsoluteUrl(nextHref, currentUrl) : null
}

export const createOneadvancedScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now: overrideNow = now,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('OneAdvanced verified careers shell no longer matches the official public jobs surface')
    }

    const jobs = []
    const seen = new Set()
    let nextUrl = SEARCH_PAGE_URL
    const scrapedAt = overrideNow()

    while (nextUrl) {
      const listingHtml = await fetchText(nextUrl)
      if (!hasOfficialSearchPageSignal(listingHtml)) {
        throw new Error('OneAdvanced verified iCIMS search page no longer matches the known public jobs surface')
      }

      for (const listing of extractJobListings(listingHtml)) {
        if (seen.has(listing.jobId)) continue
        seen.add(listing.jobId)
        const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
        jobs.push({
          ...detail,
          link: detail.applyUrl || detail.sourceUrl,
          source: SOURCE,
          scrapedAt,
        })
      }

      const candidateNext = getNextPageUrl(listingHtml, nextUrl)
      nextUrl = candidateNext && candidateNext !== nextUrl ? candidateNext : null
    }

    return jobs
  },
})

export const run = async (options = {}) => createOneadvancedScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
