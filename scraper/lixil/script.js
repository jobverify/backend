import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.lixil.com/en/careers/'
export const LINKEDIN_COMPANY_JOBS_URL = 'https://www.linkedin.com/company/lixil-global/jobs/'

const SOURCE = 'lixil'

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
      // Skip malformed blobs until the public JobPosting payload is found.
    }
  }

  return null
}

export const pageIndicatesOfficialCareersHandoff = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  const hasLinkSet =
    rawHtml.includes('https://www.linkedin.com/company/lixil-global/jobs/')
    && rawHtml.includes('https://careers.lixilamericas.com/')
    && rawHtml.includes('https://www.lixil.co.jp/corporate/recruit/')
  const hasLegacyHandoffCopy =
    normalized.includes('apply directly on linkedin or on our dedicated regional career websites')
  const hasCurrentHandoffCopy =
    /<title[^>]*>\s*Careers\s*\|\s*LIXIL\s*<\/title>/i.test(rawHtml)
    && normalized.includes('a home for everyone')
    && normalized.includes('your career can help shape that future')

  return (
    hasLinkSet
    && (hasLegacyHandoffCopy || hasCurrentHandoffCopy)
  )
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<li[\s\S]*?data-entity-urn="urn:li:jobPosting:([0-9]+)"[\s\S]*?<\/li>/gi,
)]
  .map((match) => {
    const [, jobId] = match
    const block = match[0]
    const rawHref = block.match(/<a class="base-card__full-link[^"]*" href="([^"]+)"/i)?.[1]
    const rawTitle = block.match(/<h3 class="(?:base-search-card__title|base-main-card__title)[^"]*">\s*([\s\S]*?)\s*<\/h3>/i)?.[1]
    const rawCompany = block.match(/<h4 class="(?:base-search-card__subtitle|base-main-card__subtitle)[^"]*">[\s\S]*?<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i)?.[1]
    const rawLocation = block.match(/<span class="(?:job-search-card__location|main-job-card__location)[^"]*">\s*([\s\S]*?)\s*<\/span>/i)?.[1]
    const postingDate = block.match(/<time class="(?:job-search-card__listdate|main-job-card__listdate(?:--new)?)[^"]*" datetime="([^"]+)"/i)?.[1]
    const sourceUrl = normalizeWhitespace(rawHref)?.replace(/&amp;/g, '&')
    const title = stripTags(rawTitle)
    const company = stripTags(rawCompany)
    const locationData = parseLocation(stripTags(rawLocation))

    if (!title || !jobId || !sourceUrl || locationData.country !== 'India') return null

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

export const createLixilScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const careersHtml = await fetchText(CAREER_PAGE_URL)

    if (!pageIndicatesOfficialCareersHandoff(careersHtml)) {
      throw new Error('LIXIL careers page no longer exposes the expected LinkedIn and regional-site handoff')
    }

    const searchHtml = await fetchText(LINKEDIN_COMPANY_JOBS_URL)
    const listings = extractSearchResults(searchHtml)
    const enrichedJobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml)
      const mergedLocation = (
        detail.location
        && listing.location
        && detail.country === listing.country
        && listing.location.length > detail.location.length
      )
        ? listing.location
        : detail.location

      enrichedJobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value != null),
        ),
        location: mergedLocation || listing.location,
        city: detail.city || listing.city,
        country: detail.country || listing.country,
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

export const run = async () => createLixilScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total LIXIL India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
