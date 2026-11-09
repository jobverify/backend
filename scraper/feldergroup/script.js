import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://felder-group.jobs/en'
export const SEARCH_URL = 'https://felder-group.jobs/en/job-vacancies'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const absoluteUrl = (value) => {
  if (!value) return null
  return new URL(value, CAREERS_URL).href
}

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = location.split(/[-,]/).map(normalizeWhitespace).filter(Boolean)
  return {
    location: parts.join(', '),
    city: parts[0] || null,
    country: parts.at(-1) || null,
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('full')) return 'Full-time'
  if (normalized.includes('part')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const extractJsonLd = (html) => {
  const raw = String(html ?? '').match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.find((entry) => entry?.['@type'] === 'JobPosting')
      : parsed
  } catch {
    return null
  }
}

export const extractSearchResults = (html) => {
  const cards = String(html ?? '').match(/<article[^>]*class=["'][^"']*job-item[^"']*["'][^>]*>[\s\S]*?<\/article>/gi) || []
  const results = []

  for (const card of cards) {
    const href = card.match(/<a[^>]+class=["'][^"']*job-link[^"']*["'][^>]+href=["']([^"']*\/jobs\/[^"']+_j(\d+))["']/i)
    if (!href) continue

    const title = stripTags(card.match(/<a[^>]+class=["'][^"']*job-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1])
    const category = stripTags(card.match(/<div[^>]+class=["'][^"']*job-category[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const locationText = stripTags(card.match(/<div[^>]+class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const { location, city, country } = parseLocation(locationText)

    if (!title || !location || !/\bIndia\b/i.test(country || location)) continue

    results.push({
      title,
      category,
      location,
      city,
      country,
      jobId: href[2],
      requisitionId: href[2],
      sourceUrl: absoluteUrl(href[1]),
    })
  }

  return results
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createFelderGroupScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const searchHtml = await fetchText(SEARCH_URL)
    const listings = extractSearchResults(searchHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJsonLd(detailHtml) || {}
      const applyPath = detailHtml.match(/href=["']([^"']*\/en\/application\?jobId=\d+)["'][^>]*>\s*Apply/i)?.[1]
      const parsedLocation = parseLocation(
        detail.jobLocation?.address
          ? [
              detail.jobLocation.address.addressLocality,
              detail.jobLocation.address.addressCountry,
            ].filter(Boolean).join(', ')
          : listing.location,
      )

      jobs.push({
        title: normalizeWhitespace(detail.title) || listing.title,
        company: 'FELDER Group',
        location: parsedLocation.location || listing.location,
        city: parsedLocation.city || listing.city,
        country: parsedLocation.country || listing.country || 'India',
        link: absoluteUrl(applyPath) || listing.sourceUrl,
        applyUrl: absoluteUrl(applyPath) || listing.sourceUrl,
        sourceUrl: listing.sourceUrl,
        source: 'feldergroup',
        jobId: listing.jobId,
        requisitionId: listing.requisitionId,
        department: listing.category,
        employmentType: normalizeEmploymentType(detail.employmentType),
        experienceRequired: null,
        postingDate: normalizeWhitespace(detail.datePosted),
        closingDate: normalizeWhitespace(detail.validThrough),
        jobDescription: stripTags(detail.description),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        remoteStatus: 'On-site',
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createFelderGroupScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'feldergroup')
  }
}
