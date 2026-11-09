import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'netenrichtechnologies'
export const COMPANY = 'Netenrich Technologies'
export const CAREERS_URL = 'https://netenrich.com/careers'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const isIndiaLocation = (value) => /\bindia\b/i.test(String(value ?? ''))

const normalizeIndiaListingLocation = (value, countryHint = null) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (isIndiaLocation(normalized)) {
    return normalized
  }

  if (/india/i.test(String(countryHint ?? ''))) {
    return `${normalized}, India`
  }

  return normalized
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Careers\s+at\s+Netenrich/i.test(page) && /Open\s+Positions/i.test(page)
}

export const extractListingCards = (html) => {
  const page = String(html ?? '')
  const legacyMatches = [...page.matchAll(
    /<article[^>]*>\s*<h3>\s*<a[^>]+href=["']([^"']+)["'][^>]*>\s*([^<]+?)\s*<\/a>\s*<\/h3>\s*<p>\s*([^<]+?)\s*<\/p>\s*<p>\s*([^<]+?)\s*<\/p>\s*<\/article>/gi,
  )]

  const liveMatches = [...page.matchAll(
    /<div class="join-team-filter-inr"[^>]*data-country="([^"]+)"[^>]*>([\s\S]*?)(?=<div class="join-team-filter-inr"|$)/gi,
  )]

  const listings = [
    ...legacyMatches
    .map((match) => ({
      title: normalizeWhitespace(match[2]),
      location: normalizeWhitespace(match[4]),
      sourceUrl: toAbsoluteUrl(match[1]),
      workModel: normalizeWhitespace(match[3]),
    }))
    .filter((item) => item.title && item.location && item.sourceUrl && isIndiaLocation(item.location)),
    ...liveMatches.map((match) => {
      const country = normalizeWhitespace(match[1])
      const blockHtml = String(match[2] ?? '')
      const title = normalizeWhitespace(blockHtml.match(/<h6[^>]*>\s*([\s\S]*?)\s*<\/h6>/i)?.[1])
      const workModel = normalizeWhitespace(blockHtml.match(/join-team-wrk-type[^>]*>\s*<p>\s*([\s\S]*?)\s*<\/p>/i)?.[1])
      const location = normalizeIndiaListingLocation(
        blockHtml.match(/join-team-location[^>]*>\s*<p>\s*([\s\S]*?)\s*<\/p>/i)?.[1],
        country,
      )
      const sourceUrl = toAbsoluteUrl(blockHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1])

      return { title, location, sourceUrl, workModel }
    }),
  ]

  return listings
    .filter((item) => item.title && item.location && item.sourceUrl && isIndiaLocation(item.location))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.sourceUrl === item.sourceUrl) === index)
}

const extractFirst = (pattern, html) => normalizeWhitespace(String(html ?? '').match(pattern)?.[1] ?? null)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(/[\/,]/)[0]?.trim() || null
}

const extractExperience = (html) => {
  const normalizedSnippet = normalizeWhitespace(String(html ?? '').match(/Experience:[\s\S]{0,160}/i)?.[0] ?? null)
  const directMatch = normalizedSnippet?.match(/Experience:\s*([0-9+.\-– ]+\s*Years?)/i)?.[1]

  return normalizeWhitespace(directMatch)
    || extractFirst(/Experience:\s*([^<\n]+?Years?)\s+(?:[A-Z][a-z]+|India|Hyderabad)/i, html)
    || extractFirst(/Experience:\s*([^<\n]+)/i, html)
}

const extractContactEmail = (html) =>
  String(html ?? '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null

const extractDetailBody = (html) =>
  String(html ?? '').match(
    /<h[23][^>]*>\s*(?:Job Role|Job Summary)\s*:?\s*<\/h[23]>([\s\S]*?)(?=<a[^>]+href=["']#form["']|<form\b|$)/i,
  )?.[1] ?? String(html ?? '')

const extractRelevantSkills = (html) => {
  const page = String(html ?? '')
  const sectionMatches = [...page.matchAll(
    /<h[23][^>]*>[\s\S]*?(?:Requirements|Key Responsibilities)[\s\S]*?<\/h[23]>\s*([\s\S]*?<ul[\s\S]*?<\/ul>)/gi,
  )]

  const skills = sectionMatches.flatMap((match) => extractListItems(match[1]))
  return skills.length > 0 ? skills : extractListItems(extractDetailBody(page))
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const detailBody = extractDetailBody(page)
  const title = extractFirst(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i, page) || listing.title || null
  const location = listing.location || extractFirst(/Experience:\s*[^<\n]+?\s+([^<\n]+)$/im, page) || 'India'
  const city = extractCity(location)
  const email = extractContactEmail(page)

  return {
    title,
    location,
    city,
    country: 'India',
    jobId: listing.sourceUrl ? new URL(listing.sourceUrl).pathname.split('/').filter(Boolean).pop() : null,
    requisitionId: listing.sourceUrl ? new URL(listing.sourceUrl).pathname.split('/').filter(Boolean).pop() : null,
    employmentType: listing.workModel,
    experienceRequired: extractExperience(page),
    department: null,
    jobDescription: stripTags(detailBody),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRelevantSkills(page),
    postingDate: null,
    closingDate: null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: email ? `mailto:${email}` : listing.sourceUrl || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'netenrichtechnologies',
  timeoutMs: 15000,
})

export const createNetenrichTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Netenrich Technologies official careers page no longer matches the verified jobs surface')
    }

    const listings = extractListingCards(careersHtml)
    if (listings.length === 0) {
      throw new Error('Netenrich Technologies verified careers page no longer exposes India job listings')
    }

    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createNetenrichTechnologiesScraper().run(options)

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
