import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://www.tataelxsi.com'
const LISTING_PATH = '/careers/job-openings'
const INDIA_LOCATIONS = new Set([
  'bangalore',
  'trivandrum',
  'chennai',
  'pune',
  'hyderabad',
  'delhi',
  'mumbai',
  'kozhikode',
  'kozhikode-punarjani',
  'kochi',
  'manesar',
  'anywhere in india',
  'india',
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2F;/gi, '/')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(value)
  return match ? transform(match) : null
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const buildJobOpeningsPageUrl = (page = 1) => {
  const url = new URL(LISTING_PATH, BASE_URL)
  if (page > 1) {
    url.searchParams.set('page', String(page))
  }
  return url.toString()
}

export const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split('/')[0]?.trim() || null
}

export const isIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return false

  return normalized
    .split('/')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .every((part) => INDIA_LOCATIONS.has(part))
}

const extractJobId = (value, sourceUrl) => {
  const normalized = normalizeWhitespace(value)
  if (normalized && /RFH\/\d+/i.test(normalized)) return normalized

  const slug = extractFirst(/\/([^/?#]+)\/?$/i, sourceUrl)
  return normalizeWhitespace(slug)
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<div class="jjbcdeo1 botm1">([\s\S]*?)<\/div>\s*<\/div>/gi,
)]
  .map((match) => {
    const cardHtml = match[1]
    const jobIdSeed = normalizeWhitespace(extractFirst(/<h5>([\s\S]*?)<\/h5>/i, cardHtml))
    const title = normalizeWhitespace(extractFirst(/<h3>([\s\S]*?)<\/h3>/i, cardHtml))
    const summary = normalizeWhitespace(extractFirst(/<p>([\s\S]*?)<\/p>/i, cardHtml))
    const sourceUrl = toAbsoluteUrl(extractFirst(/<a href="([^"]+)" class="jknmre">Know More<\/a>/i, cardHtml))
    const postingDate = normalizeWhitespace(
      extractFirst(/<div class="jjbcdeo12">[\s\S]*?<p>([\s\S]*?)<\/p>/i, cardHtml),
    )

    if (!title || !summary || !sourceUrl) return null

    const segments = summary
      .split('|')
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean)
    const location = segments[0] || null
    if (!isIndiaLocation(location)) return null

    return {
      title,
      location,
      city: extractCity(location),
      jobId: extractJobId(jobIdSeed, sourceUrl),
      requisitionId: extractJobId(jobIdSeed, sourceUrl),
      sourceUrl,
      postingDate,
      experienceRequired: segments[1] || null,
      minimumQualification: segments[2] || null,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const currentPage = extractFirst(
    /<li class="px-2 font-bold text-blue-500">\s*<a href="[^"]*page=(\d+)"/i,
    html,
    (match) => Number.parseInt(match[1], 10),
  ) ?? 1
  const pageNumbers = [...String(html).matchAll(/href="https:\/\/www\.tataelxsi\.com\/careers\/job-openings\?page=(\d+)"/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isInteger)
  const totalPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1

  return {
    currentPage: Number.isInteger(currentPage) ? currentPage : null,
    totalPages: Number.isInteger(totalPages) ? totalPages : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractFirst(/<div class="jbpam1">([\s\S]*?)<\/div>\s*<div class="aplylst/i, html)
  const responsibilitiesHtml = extractFirst(/<p><strong>Responsibilities:<\/strong><\/p>\s*<ul>([\s\S]*?)<\/ul>/i, html)
  const requirementsHtml = extractFirst(/<p><strong>Requirements:<\/strong><\/p>\s*<ul>([\s\S]*?)<\/ul>/i, html)
  const title = normalizeWhitespace(extractFirst(/<div class="jbpam botm1">[\s\S]*?<h2>([\s\S]*?)<\/h2>/i, html))
    || listing.title
    || null
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<a href="([^"]+)" target="_blank" class="japlynw">Apply Now<\/a>/i, html),
  )
  const jobDescription = stripTags(descriptionHtml)
  const requiredSkills = extractListItems(responsibilitiesHtml)
  const requirementItems = extractListItems(requirementsHtml)

  return {
    title,
    location: listing.location || null,
    city: listing.city || extractCity(listing.location),
    jobId: listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    employmentType: 'Full-time',
    experienceRequired: listing.experienceRequired || null,
    jobDescription,
    minimumQualification: requirementItems[0] || listing.minimumQualification || null,
    preferredQualification: null,
    requiredSkills,
    postingDate: listing.postingDate || null,
    closingDate: null,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
  }
}

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const run = async () => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY

  for (let page = 1; page <= maxPages; page += 1) {
    const listingHtml = await fetchText(buildJobOpeningsPageUrl(page))
    const listings = extractSearchResults(listingHtml)
    const pagination = extractPaginationSummary(listingHtml)

    if (listings.length === 0) break

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        title: detail.title || listing.title,
        company: 'Tata Elxsi',
        department: null,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        link: detail.applyUrl || listing.sourceUrl,
        applyUrl: detail.applyUrl || listing.sourceUrl,
        sourceUrl: detail.sourceUrl || listing.sourceUrl,
        source: 'tataelxsi',
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        jobDescription: detail.jobDescription,
        minimumQualification: detail.minimumQualification,
        preferredQualification: detail.preferredQualification,
        requiredSkills: detail.requiredSkills,
        postingDate: detail.postingDate || listing.postingDate,
        closingDate: detail.closingDate,
        scrapedAt: new Date().toISOString(),
      })
    }

    if (page >= (pagination.totalPages || 1)) break
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Tata Elxsi scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'tataelxsi')
    console.log('DB result:', result)
    process.exit(0)
  }
}
