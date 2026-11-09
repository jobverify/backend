import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'niramai'
export const COMPANY = 'Niramai'
export const COMPANY_DOMAIN = 'niramai.com'
export const VERIFIED_AT = '2026-07-25'
export const CAREERS_URL = 'https://niramai.com/career/'
export const SCRAPER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  countryFilter: 'India',
  atsPlatform: 'official-company-careers',
  paginationStrategy: 'verified-first-party-jobs-archive-page-plus-empty-page-2-check',
  extractionStrategy:
    'verified-simple-job-board-archive+inline-expanded-descriptions+detail-links-as-apply-urls',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;|&#x27;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTags = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n- ')
  .replace(/<[^>]+>/g, ' ')

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractMatch = (value, pattern) => String(value ?? '').match(pattern)?.[1] ?? null

const extractLines = (html) => stripTags(html)
  .split('\n')
  .map((line) => normalizeText(line))
  .filter(Boolean)

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeText(value)
    if (normalized) return normalized
  }
  return null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Jobs\s*-\s*Niramai\s*<\/title>/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/niramai\.com\/career\/(?:page\/\d+\/)?["']\s*\/?>/i.test(page)
    && /Jobs Archive - Niramai/i.test(normalized)
    && /niramai\.com\/career\/feed\//i.test(page)
    && /simple-job-board/i.test(page)
}

const hasArchiveContinuationSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Jobs(?:\s*-\s*Page\s*\d+\s*of\s*\d+)?\s*-\s*Niramai\s*<\/title>/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/niramai\.com\/career\/(?:page\/\d+\/)?["']\s*\/?>/i.test(page)
    && /sjb-page/i.test(page)
}

export const extractNextPageUrl = (html, currentUrl = CAREERS_URL) => {
  const nextHref = extractMatch(
    html,
    /<link rel=["']next["'] href=["']([^"']+)["']\s*\/?>/i,
  )

  if (!nextHref) return null

  const nextUrl = toAbsoluteUrl(nextHref)
  return nextUrl && nextUrl !== currentUrl ? nextUrl : null
}

const extractDescriptionHtml = (block) => {
  const rawBlock = String(block ?? '')
  const start = rawBlock.search(/<div class="sjb_more_content"[^>]*>/i)
  const end = rawBlock.search(/<div class="job-description">/i)
  if (start < 0 || end < 0 || end <= start) {
    return ''
  }

  const description = rawBlock
    .slice(start, end)
    .replace(/^<div class="sjb_more_content"[^>]*>/i, '')
    .replace(/<\/div>\s*$/i, '')

  return description
    ? description
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .trim()
    : ''
}

export const extractListingCards = (html) => {
  const page = String(html ?? '')
  const blockStarts = [...page.matchAll(/<div class="list-data">/gi)].map((match) => match.index)
  const blocks = blockStarts.map((start, index) => page.slice(start, blockStarts[index + 1]))

  return blocks.map((block) => {
    const sourceUrl = toAbsoluteUrl(
      extractMatch(block, /<div class="job-info">[\s\S]*?<a href="([^"]+)">/i)
      || extractMatch(block, /<a href="([^"]+)" class="btn btn-primary">\s*Read More\s*<\/a>/i),
    )
    const title = normalizeText(extractMatch(block, /<span class="job-title">([\s\S]*?)<\/span>/i))
    const company = firstNonEmpty(
      extractMatch(block, /<span class="company-name">([\s\S]*?)<\/span>/i),
      COMPANY,
    )
    const employmentType = normalizeText(
      extractMatch(block, /<div class="job-type">[\s\S]*?<\/i>\s*([\s\S]*?)<\/div>/i),
    )
    const location = normalizeText(
      extractMatch(block, /<div class="job-location">[\s\S]*?<\/i>\s*([\s\S]*?)<\/div>/i),
    )
    const descriptionHtml = extractDescriptionHtml(block)

    if (!sourceUrl || !title || title === 'Job Archives' || !employmentType || !location || !descriptionHtml) {
      return null
    }

    return {
      title,
      company,
      employmentType,
      location,
      sourceUrl,
      descriptionHtml,
    }
  }).filter(Boolean)
}

const extractRequiredSkills = (descriptionHtml) => unique(
  [...String(descriptionHtml ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean),
)

const unique = (values) => [...new Set(values.filter(Boolean))]

const countMatches = (value, pattern) => [...String(value ?? '').matchAll(pattern)].length

const stripBulletPrefix = (value) => normalizeText(String(value ?? '').replace(/^-+\s*/, ''))

const extractExperienceRequired = (lines) => {
  const line = lines.find((entry) => /\b\d+\+?\s+years?\b/i.test(entry))
    || lines.find((entry) => /\bexperience\b/i.test(entry))
  return line ? stripBulletPrefix(line) : null
}

const extractMinimumQualification = (lines) => {
  const line = lines.find((entry) => /^-?\s*Education\s*:/i.test(entry))
    || lines.find((entry) => /\bBachelor(?:'s)? degree\b/i.test(entry))
  return line ? stripBulletPrefix(line) : null
}

const buildJobDescription = (descriptionHtml) => {
  const lines = extractLines(descriptionHtml)
    .map((line) => line.replace(/^- - /, '- '))

  return lines.length > 0 ? lines.join('\n') : null
}

const normalizeLocation = (value) => {
  const location = normalizeText(value)
  if (!location) {
    return { location: null, city: null }
  }

  const city = normalizeCity(location.split(',')[0])
  return {
    location,
    city: city || null,
  }
}

const normalizeListing = (listing, now) => {
  const { location, city } = normalizeLocation(listing.location)
  const slug = new URL(listing.sourceUrl).pathname.split('/').filter(Boolean).at(-1)
  const lines = extractLines(listing.descriptionHtml)
  const requiredSkills = extractRequiredSkills(listing.descriptionHtml)

  return {
    title: listing.title,
    company: listing.company,
    department: null,
    location,
    city,
    country: 'India',
    jobId: `${SOURCE}-${slugify(slug)}`,
    requisitionId: `${SOURCE}-${slugify(slug)}`,
    sourceUrl: listing.sourceUrl,
    applyUrl: listing.sourceUrl,
    employmentType: listing.employmentType,
    workplaceType: null,
    experienceRequired: extractExperienceRequired(lines),
    minimumQualification: extractMinimumQualification(lines),
    preferredQualification: null,
    requiredSkills,
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(listing.descriptionHtml),
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: 'official-company-careers',
    link: listing.sourceUrl,
    scrapedAt: now(),
  }
}

export const createNiramaiScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const visited = new Set()
    const listings = []
    let nextUrl = CAREERS_URL

    while (nextUrl && !visited.has(nextUrl)) {
      visited.add(nextUrl)

      const html = await fetchText(nextUrl)
      const hasExpectedSignal = nextUrl === CAREERS_URL
        ? hasOfficialCareersSignal(html)
        : hasArchiveContinuationSignal(html)
      if (!hasExpectedSignal) {
        throw new Error('Niramai verified careers archive no longer matches the trusted first-party surface')
      }

      const pageListings = extractListingCards(html)
      if (nextUrl === CAREERS_URL) {
        const quickApplyCount = countMatches(html, /job_id="\d+"/gi)
        const quickApplyLabelCount = countMatches(html, />\s*Quick Apply\s*</gi)
        const readMoreCount = countMatches(html, />\s*Read More\s*</gi)
        if (pageListings.length === 0) {
          throw new Error('Niramai verified careers archive no longer exposes listing cards')
        }
        if (
          quickApplyCount < pageListings.length
          || quickApplyLabelCount < pageListings.length
          || readMoreCount < pageListings.length
        ) {
          throw new Error('Niramai verified careers archive no longer matches the trusted first-party surface')
        }
      }

      listings.push(...pageListings)
      nextUrl = extractNextPageUrl(html, nextUrl)
    }

    if (listings.length === 0) {
      throw new Error('Niramai verified careers archive no longer exposes listing cards')
    }

    return unique(listings.map((listing) => listing.sourceUrl))
      .map((sourceUrl) => listings.find((listing) => listing.sourceUrl === sourceUrl))
      .filter(Boolean)
      .map((listing) => normalizeListing(listing, now))
      .sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createNiramaiScraper().run(options)

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
