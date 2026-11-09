import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'zonescorporatesolutionspvtltd'
export const COMPANY = 'Zones Corporate Solutions Pvt Ltd'
export const HOMEPAGE_URL = 'https://in.zones.com/'
export const PRIVACY_POLICY_URL = 'https://in.zones.com/privacy-policy/'
export const LINKEDIN_COMPANY_PAGE_URL = 'https://in.linkedin.com/company/zonesindia'
export const LINKEDIN_INDIA_JOBS_URL = 'https://www.linkedin.com/jobs/search/?f_C=14454055&geoId=102713980'

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
  const country = address.addressCountry === 'IN'
    ? 'India'
    : normalizeWhitespace(address.addressCountry)
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    country,
  ].filter(Boolean)

  return {
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country,
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
      // Ignore malformed JSON-LD blocks until the public JobPosting payload is found.
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('zones india')
    && normalized.includes('technology solutions')
    && /href=["']https:\/\/in\.zones\.com\/privacy-policy\/["']/i.test(String(html ?? ''))
}

export const hasOfficialPrivacySignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('privacy policy')
    && normalized.includes('zones corporate solutions pvt ltd')
}

export const pageIndicatesZonesIndiaCompany = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('zones india | linkedin')
    && /urn:li:organization:14454055/i.test(String(html ?? ''))
    && /in\.zones\.com/i.test(String(html ?? ''))
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /data-entity-urn="urn:li:jobPosting:([0-9]+)"[\s\S]*?<a class="base-card__full-link[^"]*" href="([^"]+)"[\s\S]*?<h3 class="base-search-card__title">\s*([\s\S]*?)\s*<\/h3>[\s\S]*?<span class="job-search-card__location">\s*([\s\S]*?)\s*<\/span>[\s\S]*?<time[^>]*datetime="([^"]+)"[^>]*>/gi,
)]
  .map((match) => {
    const [, jobId, rawHref, rawTitle, rawLocation, postingDate] = match
    const sourceUrl = normalizeWhitespace(rawHref)?.replace(/&amp;/g, '&')
    const title = stripTags(rawTitle)
    const locationData = parseLocation(stripTags(rawLocation))

    if (!title || !jobId || !sourceUrl || locationData.country !== 'India') return null

    return {
      title,
      company: COMPANY,
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
    company: COMPANY,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    postingDate: normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null,
    jobDescription: stripTags(normalizeWhitespace(jobPosting?.description)) || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
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

export const createZonesCorporateSolutionsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Zones verified official India homepage no longer matches the expected company surface')
    }

    const privacyHtml = await fetchText(PRIVACY_POLICY_URL)
    if (!hasOfficialPrivacySignal(privacyHtml)) {
      throw new Error('Zones verified privacy page no longer matches the expected legal entity surface')
    }

    const companyHtml = await fetchText(LINKEDIN_COMPANY_PAGE_URL)
    if (!pageIndicatesZonesIndiaCompany(companyHtml)) {
      throw new Error('Zones verified LinkedIn company page no longer matches the expected public organization page')
    }

    const searchHtml = await fetchText(LINKEDIN_INDIA_JOBS_URL)
    const listings = extractSearchResults(searchHtml)
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
    const enrichedJobs = []

    for (const listing of selectedJobs) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml)

      if (detail.country && detail.country !== 'India') {
        throw new Error('Zones LinkedIn detail page no longer resolves to an India JobPosting payload')
      }

      enrichedJobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value != null),
        ),
      })
    }

    return enrichedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createZonesCorporateSolutionsScraper().run()

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
