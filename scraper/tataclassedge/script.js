import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://www.tataclassedge.com'

export const SOURCE = 'tataclassedge'
export const COMPANY = 'Tata ClassEdge'
export const CAREERS_URL = `${BASE_URL}/careers/`
export const OPEN_POSITIONS_URL = `${BASE_URL}/open-positions/`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, ' ')
    .replace(/<(p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, BASE_URL).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (value) => {
  if (!value) return null

  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = stripTags(value)
  if (!normalized) return null

  return /\bindia\b/i.test(normalized)
    ? normalized
    : `${normalized}, India`
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const [firstPart] = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return normalizeCity(firstPart || normalized)
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractSectionListItems = (html, heading) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<h[1-6]\\b[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h[1-6]>\\s*<ul\\b[^>]*>([\\s\\S]*?)<\\/ul>`,
      'i',
    ),
  )

  return extractListItems(match?.[1])
}

const extractParagraphAfterHeading = (html, heading) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<h[1-6]\\b[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h[1-6]>\\s*(?:<div\\b[^>]*>\\s*)*<(?:p|div)\\b[^>]*>([\\s\\S]*?)<\\/(?:p|div)>`,
      'i',
    ),
  )

  return stripTags(match?.[1])
}

const buildJobDescription = (html) => {
  const responsibilities = extractSectionListItems(html, 'Responsibilities :')
  const qualifications = extractSectionListItems(html, 'Qualification and Experience required:')
  const sections = []

  if (responsibilities.length > 0) {
    sections.push(`Responsibilities: ${responsibilities.join(' ')}`)
  }

  if (qualifications.length > 0) {
    sections.push(`Qualification and Experience required: ${qualifications.join(' ')}`)
  }

  return normalizeWhitespace(sections.join(' '))
}

export const hasOfficialOpenPositionsSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Open Positions\s*-\s*TataClassEdge\s*<\/title>/i.test(page)
    && /\bOpen Positions\b/i.test(text)
    && /href=["']https:\/\/www\.tataclassedge\.com\/job\/[^"']+\/["']/i.test(page)
    && /Apply/i.test(text)
}

export const extractOpenings = (html) => {
  if (!hasOfficialOpenPositionsSignal(html)) {
    throw new Error('verified Tata ClassEdge open positions surface no longer matches the official first-party careers page')
  }

  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<div[^>]+data-elementor-type="loop-item"[\s\S]*?(?=<div[^>]+data-elementor-type="loop-item"|<h[1-6][^>]*>\s*Post your resume|<\/main>|$)/gi,
  )) {
    const block = match[0]
    const title = stripTags(
      block.match(/elementor-widget-theme-post-title[\s\S]*?<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]
      ?? block.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1],
    )
    const location = normalizeLocation(
      block.match(/class=["'][^"']*\blocation\b[^"']*["'][\s\S]*?<h[1-6]\b[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/h[1-6]>/i)?.[1]
      ?? block.match(/class=["'][^"']*\blocation\b[^"']*["'][\s\S]*?<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1],
    )
    const sourceUrl = toAbsoluteUrl(
      block.match(/<a[^>]+href=["']([^"']*\/job\/[^"']+)["'][^>]*>\s*(?:<span[^>]*>\s*)*Apply/i)?.[1],
    )
    const jobId = slugFromUrl(sourceUrl)

    if (!title || !location || !sourceUrl || !jobId || seen.has(sourceUrl)) continue

    seen.add(sourceUrl)
    jobs.push({
      title,
      location,
      city: deriveCity(location),
      sourceUrl,
      applyUrl: sourceUrl,
      jobId,
      requisitionId: jobId,
    })
  }

  if (jobs.length === 0) {
    throw new Error('verified Tata ClassEdge open positions changed or disappeared')
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(
    String(html ?? '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ) || listing.title || null
  const location = normalizeLocation(
    extractParagraphAfterHeading(html, 'Location :'),
  ) || listing.location || null
  const qualificationItems = extractSectionListItems(html, 'Qualification and Experience required:')
  const requiredSkills = extractSectionListItems(html, 'Responsibilities :')
  const experienceRequired = qualificationItems.find((item) => /\b\d+(?:\s*-\s*\d+)?\+?\s*years?\b/i.test(item)) || null

  return {
    title,
    location,
    city: deriveCity(location || listing.location),
    country: 'India',
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: null,
    experienceRequired,
    department: null,
    minimumQualification: qualificationItems[0] || null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(html),
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

export const createTataClassEdgeScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const openingsHtml = await fetchText(OPEN_POSITIONS_URL)
    const listings = extractOpenings(openingsHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        country: detail.country || 'India',
        link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createTataClassEdgeScraper().run(options)

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
