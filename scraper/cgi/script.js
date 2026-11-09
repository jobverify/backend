import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://cgi.njoyn.com/CORP/xweb/Xweb.asp'
const SEARCH_URL = `${BASE_URL}?page=joblisting&CLID=21001&CountryID=IN`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

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
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    const url = new URL(decodeHtmlEntities(value), BASE_URL)
    if (/\/xweb\.asp$/i.test(url.pathname)) {
      url.pathname = '/CORP/xweb/Xweb.asp'
    }
    return url.toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const normalizeLocation = (location, country = 'India') => {
  const normalizedLocation = normalizeWhitespace(location)
  const normalizedCountry = normalizeWhitespace(country)
  if (!normalizedLocation) return { location: null, city: null }

  if (normalizedCountry && !new RegExp(`\\b${escapeRegExp(normalizedCountry)}\\b`, 'i').test(normalizedLocation)) {
    return {
      location: `${normalizedLocation}, ${normalizedCountry}`,
      city: extractCity(normalizedLocation),
    }
  }

  return {
    location: normalizedLocation,
    city: extractCity(normalizedLocation),
  }
}

const extractLabelValue = (label, html) => normalizeWhitespace(
  extractFirst(
    new RegExp(`<strong>\\s*${escapeRegExp(label)}\\s*:?\\s*</strong>\\s*([^<]+)`, 'i'),
    html,
  ),
)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/part.?time/.test(normalized)) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  return normalizeWhitespace(value)
}

export const buildSearchUrl = () => SEARCH_URL

export const buildDetailUrl = ({
  jobId,
  brid,
  clid = '21001',
  lang = '1',
}) => `${BASE_URL}?NTKN=c&clid=${clid}&Page=JobDetails&Jobid=${jobId}&BRID=${brid}&lang=${lang}`

export const extractSearchResults = (html) => [...String(html).matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
  .map((match) => {
    const row = match[0]
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((cellMatch) => cellMatch[1])

    if (cells.length < 5) return null

    const href = extractFirst(/<a[^>]*href=['"]([^'"]+)['"]/i, cells[0])
    const jobId = stripTags(cells[0])
    const title = stripTags(cells[1])
    const department = stripTags(cells[2])
    const country = stripTags(cells[4])

    if (!href || !jobId || !title || !country || !/india/i.test(country)) return null

    const { location, city } = normalizeLocation(stripTags(cells[3]), country)
    const sourceUrl = toAbsoluteUrl(href)

    if (!location || !sourceUrl) return null

    return {
      title,
      company: 'CGI',
      department,
      location,
      city,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(
    extractFirst(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, html),
  ) || listing.title || null
  const jobId = extractLabelValue('Job Number', html) || listing.jobId || listing.requisitionId || null
  const department = extractLabelValue('Category', html) || listing.department || null
  const { location, city } = normalizeLocation(
    extractLabelValue('Location', html) || listing.location,
    'India',
  )
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<a[^>]*class=['"][^'"]*apply-button[^'"]*['"][^>]*href=['"]([^'"]+)['"]/i, html),
  ) || listing.applyUrl || listing.sourceUrl || null

  return {
    title,
    company: listing.company || 'CGI',
    department,
    location,
    city,
    jobId,
    requisitionId: jobId,
    sourceUrl: listing.sourceUrl || applyUrl,
    applyUrl,
    employmentType: normalizeEmploymentType(extractLabelValue('Employment Type', html)),
    experienceRequired: extractLabelValue('Experience', html),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(
      extractFirst(/<section\b[^>]*id=['"]qualifications['"][^>]*>([\s\S]*?)<\/section>/i, html),
    ),
    postingDate: extractLabelValue('Posted Date', html),
    closingDate: null,
    jobDescription: stripTags(
      extractFirst(/<section\b[^>]*id=['"]jobDescription['"][^>]*>([\s\S]*?)<\/section>/i, html),
    ),
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
  const html = await fetchText(SEARCH_URL)
  const listings = extractSearchResults(html)
  const maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null
  const jobs = []

  for (const listing of listings) {
    let job = listing

    try {
      const detailHtml = await fetchText(listing.sourceUrl)
      job = {
        ...listing,
        ...extractJobDetail(detailHtml, listing),
      }
    } catch {
      job = listing
    }

    jobs.push({
      ...job,
      source: 'cgi',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    })

    if (maxJobs && jobs.length >= maxJobs) {
      break
    }
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running CGI scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'cgi')
    console.log('DB result:', result)
    process.exit(0)
  }
}
