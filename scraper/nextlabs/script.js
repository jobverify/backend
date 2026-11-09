import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nextlabs'
export const COMPANY = 'NextLabs'
export const HOMEPAGE_URL = 'https://www.nextlabs.com/'
export const CAREERS_URL = 'https://www.nextlabs.com/team/career/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const NEXTLABS_DOMAIN = 'nextlabs.com'
const SAME_LINE_BREAK_PATTERN = /<(?:br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi
const NEXTLABS_DETAIL_PATH_PATTERN = /\/job-description\/[^"'?#<>\s]+\/?/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
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
  decodeHtmlEntities(value)
    .replace(SAME_LINE_BREAK_PATTERN, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const htmlToTextLines = (html) =>
  decodeHtmlEntities(html)
    .replace(SAME_LINE_BREAK_PATTERN, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return null
  }
}

const isNextLabsDomainUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./i, '').toLowerCase() === NEXTLABS_DOMAIN
  } catch {
    return false
  }
}

const isOfficialJobDetailUrl = (value) => {
  try {
    const url = new URL(value)
    return isNextLabsDomainUrl(url.href) && NEXTLABS_DETAIL_PATH_PATTERN.test(url.pathname)
  } catch {
    return false
  }
}

const extractHeadingValue = (html, tagName) =>
  stripTags(String(html ?? '').match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))?.[1])

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const buildJobId = (detailUrl) => {
  try {
    const segments = new URL(detailUrl).pathname.split('/').filter(Boolean)
    return `${SOURCE}-${slugify(segments.at(-1))}`
  } catch {
    return `${SOURCE}-${slugify(detailUrl) || 'role'}`
  }
}

const deriveDepartment = (lines = [], locationIndex = -1) => {
  if (locationIndex <= 0) return null

  for (let index = locationIndex - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (!line) continue
    if (/career openings/i.test(line)) continue
    if (/about nextlabs/i.test(line)) continue
    return line
  }

  return null
}

const extractLocationLine = (lines = []) =>
  lines.find((line) => /^Location\s*:/i.test(line)) || null

const pickIndiaLocation = (locationLine) => {
  const normalizedLocation = normalizeWhitespace(String(locationLine ?? '').replace(/^Location\s*:/i, ''))
  if (!normalizedLocation) return null

  const segments = normalizedLocation
    .split(/\s*[;|/]\s*/g)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean)

  const indiaSegment = segments.find((segment) => /\bindia\b/i.test(segment))
  if (indiaSegment) return indiaSegment

  return /\bindia\b/i.test(normalizedLocation) ? normalizedLocation : null
}

const deriveCity = (location) => {
  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation) return null

  return normalizeWhitespace(
    normalizedLocation
      .replace(/\s*,?\s*india\s*$/i, '')
      .split(',')[0],
  )
}

const extractJobDescription = (lines = [], locationIndex = -1) => {
  if (locationIndex < 0) return null

  const descriptionLines = []
  for (let index = locationIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) continue
    if (/^Interested candidates may send resume/i.test(line)) break
    if (/^Join the NextLabs team/i.test(line)) break
    descriptionLines.push(line)
  }

  return normalizeWhitespace(descriptionLines.join(' '))
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Home\s*-\s*NextLabs\s*<\/title>/i.test(page)
    && /href=["'](?:https:\/\/www\.nextlabs\.com)?\/team\/career\/?["']/i.test(page)
    && /Copyright\s*©\s*20\d{2}\s*NextLabs,\s*Inc\./i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*Career\s*-\s*NextLabs\s*<\/title>/i.test(page)
    && normalized.includes('career openings')
    && normalized.includes('join the nextlabs team')
    && /\/job-description\//i.test(page)
}

export const hasOfficialJobDetailSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*JD:\s*.+\s*-\s*NextLabs\s*<\/title>/i.test(page)
    && /Location\s*:/i.test(page)
    && normalized.includes('about nextlabs')
    && normalized.includes('join the nextlabs team')
}

export const extractJobDetailUrls = (html) => {
  const urls = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const resolvedUrl = toAbsoluteUrl(match[1])
    if (!resolvedUrl || !isOfficialJobDetailUrl(resolvedUrl)) continue
    urls.add(resolvedUrl)
  }

  return [...urls]
}

export const extractJobDetail = (html, detailUrl) => {
  const lines = htmlToTextLines(html)
  const title = extractHeadingValue(html, 'h1') || lines[0] || null
  const locationLine = extractLocationLine(lines)
  const locationIndex = lines.findIndex((line) => line === locationLine)
  const department = deriveDepartment(lines, locationIndex)
  const location = pickIndiaLocation(locationLine)

  return {
    title,
    department,
    location,
    city: deriveCity(location),
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    jobDescription: extractJobDescription(lines, locationIndex),
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

export const createNextLabsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('NextLabs official homepage changed; refusing to trust careers links')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('NextLabs official careers surface changed; refusing to trust public listings')
    }

    const detailUrls = extractJobDetailUrls(careersHtml)
    if (detailUrls.length === 0) {
      throw new Error('NextLabs official careers surface changed; no same-domain job detail links found')
    }

    const jobs = []

    for (const detailUrl of detailUrls) {
      const detailHtml = await fetchText(detailUrl)
      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error('NextLabs official job detail surface changed; refusing to trust public listings')
      }

      const detail = extractJobDetail(detailHtml, detailUrl)
      if (!detail.title || !detail.location) continue

      const jobId = buildJobId(detailUrl)
      jobs.push({
        ...detail,
        company: COMPANY,
        country: 'India',
        source: SOURCE,
        jobId,
        requisitionId: jobId,
        employmentType: null,
        postingDate: null,
        closingDate: null,
        preferredQualification: null,
        requiredSkills: [],
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createNextLabsScraper().run(options)

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
