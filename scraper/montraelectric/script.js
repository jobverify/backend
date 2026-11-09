import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'montraelectric'
export const COMPANY = 'MONTRA ELECTRIC'
export const HOMEPAGE_URL = 'https://www.montraelectric.com/'
export const CAREERS_URL = 'https://www.montraelectric.com/life-montra'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const KNOWN_CITIES = new Set([
  'bengaluru',
  'bangalore',
  'chennai',
  'hyderabad',
  'mumbai',
  'pune',
  'gurugram',
  'noida',
  'delhi',
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const absoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const hasSectionSignal = (html, pattern) => pattern.test(String(html ?? ''))

const extractBetweenHeadings = (html, startHeading, endHeading) => {
  const page = String(html ?? '')
  const startMatch = page.match(startHeading)
  if (!startMatch) return null

  const startIndex = startMatch.index + startMatch[0].length
  const rest = page.slice(startIndex)
  const endMatch = rest.match(endHeading)

  if (!endMatch) return rest

  return rest.slice(0, endMatch.index)
}

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) {
    return {
      location: null,
      city: null,
    }
  }

  const cleaned = location.replace(/,?\s*india$/i, '').trim()
  const city = KNOWN_CITIES.has(cleaned.toLowerCase()) ? cleaned : null

  return {
    location: `${cleaned}, India`,
    city,
  }
}

const parseCard = (cardHtml, index) => {
  const title = stripTags(cardHtml.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
  const cardText = stripTags(cardHtml) || ''
  const groupedMetaMatch = cardText.match(
    /Designation:\s*(.*?)\s+Experience:\s*(.*?)\s+Function:\s*(.*?)\s+Location:\s*(.*)$/i,
  )
  const paragraphTexts = groupedMetaMatch
    ? []
    : [...cardHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => stripTags(match[1]))
      .filter(Boolean)

  const valueFor = (label) => {
    const prefix = `${label}:`
    return normalizeWhitespace(
      paragraphTexts.find((text) => text.toLowerCase().startsWith(prefix.toLowerCase()))?.slice(prefix.length),
    )
  }

  const designationText = normalizeWhitespace(groupedMetaMatch?.[1]) || valueFor('Designation')
  const experienceText = normalizeWhitespace(groupedMetaMatch?.[2]) || valueFor('Experience')
  const functionText = normalizeWhitespace(groupedMetaMatch?.[3]) || valueFor('Function')
  const locationText = normalizeWhitespace(groupedMetaMatch?.[4]) || valueFor('Location')
  const applyUrl = absoluteUrl(
    cardHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1],
  )
  const { location, city } = parseLocation(locationText)
  const jobSlug = slugify(`${title}-${locationText || index + 1}-${index + 1}`)
  const jobId = jobSlug ? `${SOURCE}-${jobSlug}` : null

  if (!title || !designationText || !experienceText || !functionText || !location || !jobId) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: functionText,
    location,
    city,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_URL,
    applyUrl,
    employmentType: null,
    experienceRequired: designationText,
    minimumQualification: experienceText,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      `Function: ${functionText}`,
      `Designation: ${designationText}`,
      `Experience: ${experienceText}`,
      `Location: ${locationText}`,
    ].join(' | '),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Montra Electric\s*\|/i.test(page)
    && /Life @ Montra/i.test(page)
    && /Join us and be part of building the future of mobility/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /EV Careers at Montra Electric/i.test(page)
    && /Current Openings/i.test(text)
    && /Join Montra Electric/i.test(text)
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('MONTRA ELECTRIC verified first-party careers surface no longer matches the public page')
  }

  const careersSection = extractBetweenHeadings(
    html,
    /<h2\b[^>]*>\s*Current Openings\s*<\/h2>/i,
    /<h2\b[^>]*>\s*Join Montra Electric\s*<\/h2>/i,
  ) || String(html ?? '')

  const jobs = [...careersSection.matchAll(
    /<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|<\/section>|<h2\b|$)/gi,
  )]
    .map((match, index) => parseCard(match[0], index))
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('MONTRA ELECTRIC verified first-party careers surface no longer exposes job openings')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMontraElectricScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('MONTRA ELECTRIC verified official homepage no longer matches the first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicListings(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createMontraElectricScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total MONTRA ELECTRIC jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
