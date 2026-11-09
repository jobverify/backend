import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import LOCOBUZZ_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LOCOBUZZ_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_URL = 'mailto:careers@locobuzz.com'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const INDIA_LOCATION_PATTERN =
  /\b(bangalore|bengaluru|chennai|delhi|gurgaon|gurugram|hyderabad|india|kolkata|mumbai|noida|pune)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const ensureIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const isIndiaLocation = (location) => INDIA_LOCATION_PATTERN.test(location || '')

const findErrorInChain = (error, predicate) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (predicate(current)) {
      return current
    }
    current = current?.cause
  }

  return null
}

const hasHttpStatus = (error, status) =>
  Boolean(findErrorInChain(error, (candidate) => Number(candidate?.status) === status))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractTextLines = (html = '') => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)

const parseHeadingOpeningDetails = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(
    /^(.+?)\s+(\d+(?:\s*[+\-–]\s*\d+)?\+?\s*(?:Years?|years|Yrs?|yrs?))$/i,
  )

  if (!match) return null

  return {
    location: normalizeWhitespace(match[1]),
    experience: normalizeWhitespace(match[2]),
  }
}

const extractHeadingOpenings = (html = '', sourceUrl = CAREERS_URL) => {
  const lines = extractTextLines(html)
  const startIndex = lines.findIndex((line) => /^Open Positions$/i.test(line))
  if (startIndex < 0) return []

  const endIndex = lines.findIndex((line, index) =>
    index > startIndex && /^See Locobuzz in action$/i.test(line))
  const sectionLines = lines
    .slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined)
    .filter((line) =>
      !/^Find your fit/i.test(line)
      && !/careers@locobuzz\.com/i.test(line))

  const jobs = []
  for (let index = 0; index < sectionLines.length - 1; index += 1) {
    const title = normalizeWhitespace(sectionLines[index])
    const details = parseHeadingOpeningDetails(sectionLines[index + 1])

    if (!title || !details || !isIndiaLocation(details.location)) {
      continue
    }

    const location = ensureIndiaLocation(details.location)
    jobs.push({
      title,
      company: PROVIDER_METADATA.companyName,
      department: null,
      location,
      city: location?.split(/[\/,]/)[0]?.trim() || null,
      country: 'India',
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl,
      applyUrl: APPLICATION_URL,
      employmentType: null,
      experienceRequired: details.experience,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
    index += 1
  }

  return jobs
}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html)
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return /<title>\s*Careers at Locobuzz/i.test(rawHtml)
    && normalized.includes('open positions')
    && normalized.includes('careers@locobuzz.com')
}

export const extractOpenings = (html = '', { sourceUrl = CAREERS_URL } = {}) => {
  const jobs = []

  for (const match of String(html).matchAll(
    /<section[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/section>/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const rawLocation = normalizeWhitespace(match[2])
    const experience = normalizeWhitespace(match[3])

    if (!isIndiaLocation(rawLocation)) continue

    const location = ensureIndiaLocation(rawLocation)
    jobs.push({
      title,
      company: PROVIDER_METADATA.companyName,
      department: null,
      location,
      city: location?.split(/[\/,]/)[0]?.trim() || null,
      country: 'India',
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl,
      applyUrl: APPLICATION_URL,
      employmentType: null,
      experienceRequired: experience,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }

  return jobs.length > 0 ? jobs : extractHeadingOpenings(html, sourceUrl)
}

const loadCareersPage = async (fetchText) => {
  try {
    return {
      careersUrl: CAREERS_URL,
      careersHtml: await fetchText(CAREERS_URL),
    }
  } catch (error) {
    if (CAREERS_URL.endsWith('/') || !hasHttpStatus(error, 307)) {
      throw error
    }

    const canonicalUrl = `${CAREERS_URL}/`
    return {
      careersUrl: canonicalUrl,
      careersHtml: await fetchText(canonicalUrl),
    }
  }
}

export const createLocobuzzScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const { careersUrl, careersHtml } = await loadCareersPage(fetchText)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Locobuzz careers page no longer matches the verified first-party public jobs surface')
    }

    return extractOpenings(careersHtml, { sourceUrl: careersUrl }).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createLocobuzzScraper().run(options)

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
