import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'opsera'
export const COMPANY = 'Opsera'
export const CAREERS_URL = 'https://www.opsera.io/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6]|\/a|\/ul|\/ol)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|main|h[1-6]|a|ul|ol)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const stripTags = (value) => stripTagsToLines(value).join(' ')

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), CAREERS_URL).toString()
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

const isOpseraDetailUrl = (value) => {
  if (!value) return false

  try {
    const parsed = new URL(value)
    return /^opsera\.ai$/i.test(parsed.hostname)
      && /^\/careers\/[^/]+\/?$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

const getCurrentPositionsSection = (html) => String(html ?? '').match(
  /Current Positions([\s\S]*?)(?:<\/main>|<footer\b|$)/i,
)?.[1] || null

const getVerifiedDetailSlice = (html) => {
  const page = String(html ?? '')
  return page.match(
    /<h1\b[^>]*>[\s\S]*?<\/h1>([\s\S]*?)(?:Back to Careers|Share on X|<\/main>|<footer\b|$)/i,
  )?.[0] || page
}

const findFirstMatchingLine = (lines, pattern) =>
  lines.find((line) => pattern.test(line)) || null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const section = getCurrentPositionsSection(page)

  return /Let(?:'|’|&#39;|&rsquo;)?s Grow Together/i.test(page)
    && /Current Positions/i.test(page)
    && /India-based,\s*Remote Position/i.test(page)
    && /https:\/\/opsera\.ai\/careers\/[^"' ]+\/?/i.test(section || '')
}

export const extractListings = (html) => {
  const section = getCurrentPositionsSection(html)
  if (!section) return []

  const jobs = []
  const seen = new Set()

  for (const match of section.matchAll(
    /<a[^>]+href=["'](https:\/\/opsera\.ai\/careers\/[^"']+\/?)["'][^>]*>\s*([\s\S]*?)\s*<\/a>([\s\S]*?)(?:<a[^>]*>\s*View Job\s*<\/a>|<\/article>|$)/gi,
  )) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const title = normalizeWhitespace(stripTags(match[2]))
    const lines = stripTagsToLines(match[3])
    const location = findFirstMatchingLine(lines, /\bIndia-based\b|\bUS-based\b/i)
    const employmentType = findFirstMatchingLine(lines, /\bfull[\s-]*time\b|\bpart[\s-]*time\b|\bcontract\b/i)
    const department = findFirstMatchingLine(lines, /^(Development|Product|Sales)$/i)
    const jobId = slugFromUrl(sourceUrl)

    if (!isOpseraDetailUrl(sourceUrl) || !title || /^view job$/i.test(title) || seen.has(sourceUrl)) continue
    if (!location || !/\bindia-based\b/i.test(location)) continue

    seen.add(sourceUrl)
    jobs.push({
      title,
      sourceUrl,
      applyUrl: sourceUrl,
      location,
      employmentType,
      department,
      jobId,
      requisitionId: jobId,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const detailSlice = getVerifiedDetailSlice(html)
  const title = normalizeWhitespace(detailSlice.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || listing.title || null
  const lines = stripTagsToLines(detailSlice)
  const metadataLines = new Set(
    [
      title,
      listing.department,
      listing.employmentType,
      listing.location,
      'Apply Now',
      'Back to Careers',
    ].filter(Boolean),
  )

  const jobDescription = normalizeWhitespace(
    lines
      .filter((line) => !metadataLines.has(line))
      .join(' '),
  )

  return {
    title,
    company: COMPANY,
    location: listing.location || null,
    city: /\bremote\b/i.test(listing.location || '') ? null : 'India',
    country: 'India',
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: listing.employmentType || null,
    department: listing.department || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
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

export const createOpseraScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Opsera verified official careers surface changed')
    }

    const listings = extractListings(careersHtml)
    if (listings.length === 0) {
      throw new Error('Opsera verified official careers surface no longer exposes public India listings')
    }

    const jobs = []

    for (const listing of listings) {
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

export const run = async (options = {}) => createOpseraScraper().run(options)

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
