import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'yieldengineeringsystemsindia'
export const COMPANY = 'Yield Engineering Systems India P Ltd'
export const HOMEPAGE_URL = 'https://www.yes.tech/'
export const LINKEDIN_COMPANY_JOBS_URL =
  'https://www.linkedin.com/company/yield-engineering-systems/jobs?trk=nav_type_jobs'
export const LINKEDIN_INDIA_JOBS_API_URL =
  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?f_C=109619&geoId=102713980'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const parseCriteria = (html) => {
  const criteriaPairs = [...String(html ?? '').matchAll(
    /<li class="description__job-criteria-item">[\s\S]*?<h3 class="description__job-criteria-subheader">\s*([\s\S]*?)\s*<\/h3>[\s\S]*?<span class="description__job-criteria-text description__job-criteria-text--criteria">\s*([\s\S]*?)\s*<\/span>[\s\S]*?<\/li>/gi,
  )]

  const criteria = {}
  for (const [, label, value] of criteriaPairs) {
    const normalizedLabel = stripTags(label)
    const normalizedValue = stripTags(value)

    if (normalizedLabel && normalizedValue) {
      criteria[normalizedLabel] = normalizedValue
    }
  }

  return criteria
}

const parseJobPostingJsonLd = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') {
        return parsed
      }
    } catch {
      // Ignore malformed JSON-LD blocks and continue scanning.
    }
  }

  return null
}

const detailLocationFromJsonLd = (jobPosting) => {
  const address = jobPosting?.jobLocation?.address || {}
  const region = normalizeWhitespace(address.addressRegion)
  const countryCode = normalizeWhitespace(address.addressCountry)
  const country = countryCode === 'IN' ? 'India' : countryCode
  const parts = [
    normalizeWhitespace(address.addressLocality),
    region,
    country,
  ].filter(Boolean)

  return {
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country: country || null,
  }
}

const extractLinkByText = (html, textPattern) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = normalizeWhitespace(match[1])
    const anchorText = stripTags(match[2])

    if (href && anchorText && textPattern.test(anchorText)) {
      return href
    }
  }

  return null
}

const buildDetailUrl = (jobId, sourceUrl) => {
  if (sourceUrl) return sourceUrl
  return `https://www.linkedin.com/jobs/view/${jobId}`
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return normalized.includes('Yield Engineering Systems Process Engineering Equipment')
    && normalized.includes('Yield Engineering Systems, Inc.')
    && normalized.includes('Recruitment')
    && String(html ?? '').includes(LINKEDIN_COMPANY_JOBS_URL)
}

export const extractOfficialJobsHandoff = (html) =>
  extractLinkByText(html, /^careers$|^recruitment$/i)

export const buildSearchUrl = ({ start = 0 } = {}) =>
  `${LINKEDIN_INDIA_JOBS_API_URL}&start=${Math.max(0, Number(start) || 0)}`

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<div\b[^>]*class="[^"]*\bbase-card\b[^"]*\bjob-search-card\b[^"]*"[\s\S]*?<\/li>/gi,
)]
  .map((match) => {
    const cardHtml = match[0]
    const jobId = normalizeWhitespace(
      cardHtml.match(/data-entity-urn="urn:li:jobPosting:([0-9]+)"/i)?.[1],
    )
    const rawHref = cardHtml.match(/<a\b[^>]*class="[^"]*\bbase-card__full-link\b[^"]*"[^>]*href="([^"]+)"/i)?.[1]
    const rawTitle = cardHtml.match(/<h3 class="base-search-card__title">\s*([\s\S]*?)\s*<\/h3>/i)?.[1]
    const rawLocation = cardHtml.match(/<span class="job-search-card__location">\s*([\s\S]*?)\s*<\/span>/i)?.[1]
    const postingDate = cardHtml.match(/<time class="job-search-card__listdate" datetime="([^"]+)"/i)?.[1]
    const sourceUrl = normalizeWhitespace(rawHref)
    const title = stripTags(rawTitle)
    const locationData = parseLocation(stripTags(rawLocation))

    if (!title || !jobId || !sourceUrl || locationData.country !== 'India') {
      return null
    }

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
  const criteria = parseCriteria(html)
  const title = stripTags(
    String(html ?? '').match(/<h1 class="top-card-layout__title[^"]*">\s*([\s\S]*?)\s*<\/h1>/i)?.[1] ?? null,
  )
  const listedCompany = stripTags(
    String(html ?? '').match(/<a class="topcard__org-name-link[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/a>/i)?.[1] ?? null,
  )
  const locationText = stripTags(
    String(html ?? '').match(/<span class="topcard__flavor topcard__flavor--bullet">\s*([\s\S]*?)\s*<\/span>/i)?.[1] ?? null,
  )
  const fallbackLocation = parseLocation(locationText)
  const descriptionHtml = String(html ?? '').match(
    /<div class="show-more-less-html__markup[\s\S]*?">([\s\S]*?)<\/div>\s*<button class="show-more-less-html__button/mi,
  )?.[1]
  const jsonLdLocation = jobPosting ? detailLocationFromJsonLd(jobPosting) : fallbackLocation

  return {
    title: title || normalizeWhitespace(jobPosting?.title) || null,
    listedCompany: listedCompany || normalizeWhitespace(jobPosting?.hiringOrganization?.name) || null,
    location: jsonLdLocation.location || fallbackLocation.location,
    city: jsonLdLocation.city || fallbackLocation.city,
    country: jsonLdLocation.country || fallbackLocation.country,
    department: criteria['Job function'] || null,
    employmentType: criteria['Employment type'] || normalizeWhitespace(jobPosting?.employmentType)?.replace('_', '-') || null,
    experienceRequired: criteria['Seniority level'] || null,
    preferredQualification: criteria.Industries || null,
    postingDate: normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null,
    jobDescription: stripTags(descriptionHtml || jobPosting?.description) || null,
  }
}

export const createYieldEngineeringSystemsIndiaScraper = ({
  maxJobs = null,
  maxPages = 5,
  pageSize = 25,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Yield Engineering Systems homepage no longer matches the verified official careers handoff surface')
    }

    const officialJobsHandoff = extractOfficialJobsHandoff(homepageHtml)
    if (officialJobsHandoff !== LINKEDIN_COMPANY_JOBS_URL) {
      throw new Error('Yield Engineering Systems homepage no longer links to the verified LinkedIn jobs handoff')
    }

    const listings = []
    const seenIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const start = page * pageSize
      const searchHtml = await fetchText(buildSearchUrl({ start }))
      const pageListings = extractSearchResults(searchHtml)
      let newCount = 0

      for (const listing of pageListings) {
        if (seenIds.has(listing.jobId)) continue

        seenIds.add(listing.jobId)
        listings.push(listing)
        newCount += 1
      }

      if (pageListings.length === 0 || newCount === 0) {
        break
      }

      if (Number.isInteger(maxJobs) && maxJobs > 0 && listings.length >= maxJobs) {
        break
      }
    }

    const selectedJobs = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings
    const enrichedJobs = []

    for (const listing of selectedJobs) {
      const detailHtml = await fetchText(buildDetailUrl(listing.jobId, listing.sourceUrl))
      const detail = extractJobDetail(detailHtml)

      enrichedJobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail)
            .filter(([key, value]) => key !== 'listedCompany' && value != null),
        ),
      })
    }

    return enrichedJobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: LINKEDIN_COMPANY_JOBS_URL,
      companyDomain: 'yes.tech',
      atsPlatform: 'linkedin-guest-search',
    }))
  },
})

export const run = async (options = {}) => createYieldEngineeringSystemsIndiaScraper().run(options)

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
