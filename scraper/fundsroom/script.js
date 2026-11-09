import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractLinkedinJobCards } from '../../scraper-support/utils/linkedinJobCards.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const LINKEDIN_COMPANY_PAGE_URL = 'https://www.linkedin.com/company/fundsroom/jobs/'
export const LINKEDIN_INDIA_JOBS_URL = 'https://www.linkedin.com/jobs/search/?f_C=71637338&geoId=102713980'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part_time' || normalized === 'part time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const parseLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null

  return {
    location: normalized,
    city,
    country,
  }
}

const detailLocationFromJsonLd = (jobPosting) => {
  const address = jobPosting?.jobLocation?.address || {}
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    normalizeWhitespace(address.addressCountry),
  ].filter(Boolean)

  return {
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country: address.addressCountry === 'IN'
      ? 'India'
      : normalizeWhitespace(address.addressCountry),
  }
}

const parseJobPostingJsonLd = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Skip malformed JSON-LD blobs until the public JobPosting payload is found.
    }
  }

  return null
}

export const pageIndicatesFundsroomCompany = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return (
    normalized.includes('fundsroom | linkedin')
    && normalized.includes('urn:li:organization:71637338')
  )
}

export const extractSearchResults = (html) => extractLinkedinJobCards(html)
  .map(({ id: jobId, href, title: rawTitle, company: rawCompany, location, datetime }) => {
      const sourceUrl = normalizeWhitespace(href)
      const title = normalizeWhitespace(rawTitle)
      const company = normalizeWhitespace(rawCompany)
      const locationData = parseLocation(location)
      const postingDate = datetime
      if (!title || !jobId || !sourceUrl || company?.toLowerCase() !== 'fundsroom'
        || locationData.country !== 'India') return null
      try {
        const url = new URL(sourceUrl)
        if (url.protocol !== 'https:' || !/(^|\.)linkedin\.com$/i.test(url.hostname)
          || !new RegExp(`/jobs/view/(?:[^/]+-)?${jobId}/?$`).test(url.pathname)) return null
      } catch { return null }

      return {
      title,
      company,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(postingDate),
      closingDate: null,
      jobDescription: null,
      }
    })
    .filter(Boolean)

export const extractJobDetail = (html) => {
  const jobPosting = parseJobPostingJsonLd(html)
  if (!jobPosting) return {}

  const locationData = detailLocationFromJsonLd(jobPosting)

  return {
    company: normalizeWhitespace(jobPosting?.hiringOrganization?.name) || null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    postingDate: normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null,
    jobDescription: stripTags(normalizeWhitespace(jobPosting?.description)) || null,
  }
}

const defaultFetchText = async (url, { signal } = {}) => {
  const timeout = AbortSignal.timeout(20000)
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createFundsroomScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const { signal } = options
    signal?.throwIfAborted()
    const fetchText = options.fetchText || defaultFetchText
    const companyHtml = await fetchText(LINKEDIN_COMPANY_PAGE_URL, { signal })
    signal?.throwIfAborted()

    if (!pageIndicatesFundsroomCompany(companyHtml)) {
      throw new Error('Fundsroom LinkedIn company page no longer matches the expected public organization page')
    }

    const searchHtml = await fetchText(LINKEDIN_INDIA_JOBS_URL, { signal })
    signal?.throwIfAborted()
    const listings = extractSearchResults(searchHtml)
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
    const enrichedJobs = []

    for (const listing of selectedJobs) {
      signal?.throwIfAborted()
      const detailHtml = await fetchText(listing.sourceUrl, { signal })
      signal?.throwIfAborted()
      const detail = extractJobDetail(detailHtml)

      enrichedJobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value != null),
        ),
      })
    }

    return enrichedJobs.map((job) => ({
      ...job,
      source: 'fundsroom',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createFundsroomScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Fundsroom India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'fundsroom')
}
