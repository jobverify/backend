import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
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

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null
  if (['IND', 'IN', 'INDIA'].includes(normalized)) return 'India'
  return normalizeWhitespace(value)
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || /full.?time/.test(normalized) || normalized === 'permanent') return 'Full-time'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/contract/.test(normalized)) return 'Contract'
  return normalizeWhitespace(value)
}

const MONTH_INDEX = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const directIso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (directIso) return normalized

  const longDate = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/)
  if (longDate) {
    const month = MONTH_INDEX[longDate[1].toLowerCase()]
    const day = longDate[2].padStart(2, '0')
    if (month) return `${longDate[3]}-${month}-${day}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const resolveFutureClosingDate = (value, now) => {
  const isoDate = toIsoDate(value)
  if (!isoDate) return null
  const today = toIsoDate(now())
  return isoDate >= today ? isoDate : null
}

const extractFieldAfterHeading = (html, heading) => {
  const pattern = new RegExp(
    `<h[1-6][^>]*>\\s*${heading}\\s*<\\/h[1-6]>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
    'i',
  )
  return normalizeWhitespace(html.match(pattern)?.[1])
}

const extractListItems = (html = '') => (String(html ?? '').match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [])
  .map((item) => normalizeWhitespace(item))
  .filter(Boolean)

export const hasOfficialCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html) || ''
  return /Appy Pie Career/i.test(text) && /Current Search/i.test(text)
}

export const extractOpeningCounts = (html = '') => [...String(html ?? '').matchAll(
  /<span[^>]*class=["'][^"']*noofjobs[^"']*["'][^>]*>\s*\((\d+)\)\s*<\/span>/gi,
)]
  .map((match) => Number.parseInt(match[1], 10))
  .filter(Number.isFinite)

export const hasVerifiedNoOpeningsSignal = (html = '') => {
  const text = normalizeWhitespace(html) || ''
  const counts = extractOpeningCounts(html)
  return counts.length > 0
    && counts.every((count) => count === 0)
    && /\b0\s+Results\b/i.test(text)
    && /\bNo jobs found\b/i.test(text)
}

export const extractJobDetailUrls = (html = '') => [...new Set(
  [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1]))
    .filter(Boolean)
    .filter((url) => /^https:\/\/careers\.appypie\.com\/careers\/[^/]+\/?$/i.test(url))
    .filter((url) => url !== CAREERS_URL),
)]

export const extractJobPosting = (detailHtml = '') => {
  const matches = String(detailHtml ?? '').matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Ignore unrelated JSON-LD blocks.
    }
  }

  return null
}

const mapJob = (detailHtml, detailUrl, now) => {
  const jobPosting = extractJobPosting(detailHtml)
  const address = jobPosting?.jobLocation?.address ?? {}
  const country = normalizeCountry(address.addressCountry)
  if (country !== 'India') return null

  const listItems = extractListItems(detailHtml)
  const requisitionId = listItems.find((item) => /\bJR\d+\b/i.test(item))?.match(/\bJR\d+\b/i)?.[0] ?? null

  const city = normalizeWhitespace(address.addressLocality) || normalizeWhitespace(
    detailHtml.match(/<div[^>]*class=["'][^"']*joblocation[^"']*["'][^>]*>[\s\S]*?<span>(.*?)<\/span>/i)?.[1],
  )
  const state = normalizeWhitespace(address.addressRegion) || null
  const location = [city, state, country].filter(Boolean).join(', ') || country

  return {
    title: normalizeWhitespace(jobPosting?.title)
      || normalizeWhitespace(detailHtml.match(/<h1[^>]*class=["'][^"']*jobtitle[^"']*["'][^>]*>(.*?)<\/h1>/i)?.[1]),
    company: COMPANY,
    department: extractFieldAfterHeading(detailHtml, 'Job Category'),
    location,
    city,
    state,
    country,
    jobId: requisitionId || normalizeWhitespace(jobPosting?.identifier?.value) || slugify(jobPosting?.title),
    requisitionId: requisitionId || normalizeWhitespace(jobPosting?.identifier?.value) || slugify(jobPosting?.title),
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType || listItems.find((item) => /permanent/i.test(item))),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: toIsoDate(jobPosting?.datePosted),
    closingDate: resolveFutureClosingDate(jobPosting?.validThrough, now),
    jobDescription: normalizeWhitespace(jobPosting?.description),
  }
}

export const run = async ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => {
  const listingHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(listingHtml)) {
    throw new Error('Appy Pie careers page no longer matches the verified first-party job-board surface')
  }

  const detailUrls = extractJobDetailUrls(listingHtml)
  if (detailUrls.length === 0) {
    if (hasVerifiedNoOpeningsSignal(listingHtml)) {
      return []
    }
    throw new Error('Appy Pie verified careers page no longer exposes public role detail URLs')
  }

  const jobs = []
  for (const url of detailUrls) {
    const detailHtml = await fetchText(url)
    const mapped = mapJob(detailHtml, url, now)
    if (mapped) jobs.push(mapped)
  }

  return jobs.map((job) => ({
    ...job,
    source: SOURCE,
    link: job.applyUrl,
    scrapedAt: now(),
  }))
}

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
