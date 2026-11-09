import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'intellipaat'
export const COMPANY = 'Intellipaat'
export const CAREERS_URL = 'https://intellipaat.com/careers/'
export const JOBS_URL = 'https://jobs.intellipaat.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeEntities = (value) => String(value ?? '')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&rsquo;|&#39;|&apos;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#(\d+);/g, (match, code) => {
    const parsed = Number.parseInt(code, 10)
    return Number.isFinite(parsed) ? String.fromCharCode(parsed) : match
  })

const normalizeWhitespace = (value) => {
  const normalized = decodeEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const toAbsoluteUrl = (value, baseUrl = JOBS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const getJobIdFromUrl = (value) => {
  try {
    return new URL(value).pathname
      .split('/')
      .filter(Boolean)
      .at(-1) || null
  } catch {
    return null
  }
}

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  const parts = location?.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean) || []
  return {
    location,
    city: parts[0] || null,
    country: parts.at(-1) || null,
  }
}

const normalizeEmploymentType = (value) => {
  const entries = Array.isArray(value) ? value : [value]
  const normalized = entries
    .map((entry) => normalizeWhitespace(entry)?.toLowerCase())
    .filter(Boolean)

  if (normalized.some((entry) => entry.includes('full'))) return 'Full-time'
  if (normalized.some((entry) => entry.includes('part'))) return 'Part-time'
  if (normalized.some((entry) => entry.includes('contract'))) return 'Contract'
  if (normalized.some((entry) => entry.includes('intern'))) return 'Internship'

  return normalizeWhitespace(entries[0])
}

const normalizeDate = (value) => normalizeWhitespace(value)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null

const extractJsonLdObjects = (html) => {
  const objects = []

  for (const match of String(html ?? '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed)) {
        objects.push(...parsed)
      } else {
        objects.push(parsed)
      }
    } catch {
      // Ignore malformed JSON-LD blocks and keep scanning for the public JobPosting payload.
    }
  }

  return objects
}

const extractJobPostingJsonLd = (html) =>
  extractJsonLdObjects(html).find((entry) => entry?.['@type'] === 'JobPosting') || null

export const extractJobCards = (html) => {
  const jobs = []
  const cardPattern = /<div[^>]+class=["'][^"']*filter-result-item[^"']*["'][^>]*>[\s\S]*?<div[^>]+class=["'][^"']*filter-result-bottom-right[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi

  for (const match of String(html ?? '').matchAll(cardPattern)) {
    const cardHtml = match[0]
    const sourceUrl = toAbsoluteUrl(
      cardHtml.match(/<div[^>]+class=["'][^"']*internship-name[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i)?.[1],
    )
    const title = stripTags(
      cardHtml.match(/<div[^>]+class=["'][^"']*internship-name[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1],
    )
    const company = stripTags(
      cardHtml.match(/<div[^>]+class=["'][^"']*internship-company-name[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    )
    const location = stripTags(
      cardHtml.match(/<i[^>]+class=["'][^"']*address[^"']*["'][^>]*><\/i>\s*([^<]+)/i)?.[1],
    )

    if (!sourceUrl || !title || !location || !/\bIndia\b/i.test(location)) continue

    jobs.push({
      title,
      company,
      location,
      sourceUrl,
      applyUrl: sourceUrl,
    })
  }

  return [...new Map(jobs.map((job) => [job.sourceUrl, job])).values()]
}

export const extractJobDetail = (html, sourceUrl = null) => {
  const posting = extractJobPostingJsonLd(html)
  if (!posting) return null

  const location = normalizeWhitespace(
    typeof posting.jobLocation?.address === 'string'
      ? posting.jobLocation.address
      : posting.jobLocation?.address?.addressLocality
        ? [
            posting.jobLocation.address.addressLocality,
            posting.jobLocation.address.addressRegion,
            posting.jobLocation.address.addressCountry,
          ].filter(Boolean).join(', ')
        : null,
  )
  const canonicalUrl = toAbsoluteUrl(
    String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1],
  )
  const applyUrl = sourceUrl || canonicalUrl || null

  return {
    title: normalizeWhitespace(posting.title),
    company: normalizeWhitespace(posting.hiringOrganization?.name),
    location,
    employmentType: normalizeEmploymentType(posting.employmentType),
    postingDate: normalizeDate(posting.datePosted),
    closingDate: normalizeDate(posting.validThrough),
    jobDescription: stripTags(posting.description),
    applyUrl,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createIntellipaatScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const listingHtml = await fetchText(JOBS_URL)
    const listings = extractJobCards(listingHtml)

    if (listings.length === 0) {
      throw new Error('Intellipaat first-party jobs page returned no public India job cards')
    }

    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing.sourceUrl)
      const parsedLocation = parseLocation(detail?.location || listing.location)
      const jobId = getJobIdFromUrl(listing.sourceUrl)

      jobs.push({
        title: detail?.title || listing.title,
        company: COMPANY,
        location: parsedLocation.location,
        city: parsedLocation.city,
        country: parsedLocation.country || 'India',
        sourceUrl: listing.sourceUrl,
        applyUrl: detail?.applyUrl || listing.sourceUrl,
        link: detail?.applyUrl || listing.sourceUrl,
        jobId,
        requisitionId: jobId,
        department: null,
        employmentType: detail?.employmentType || null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: detail?.postingDate || null,
        closingDate: detail?.closingDate || null,
        jobDescription: detail?.jobDescription || null,
        source: SOURCE,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createIntellipaatScraper().run(options)

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
