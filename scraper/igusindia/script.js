import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.igus.in/company/career'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const absoluteUrl = (value) => {
  if (!value) return null
  return new URL(value, CAREERS_URL).href
}

const extractLocationParts = (value) => {
  const normalized = normalizeWhitespace(value) || 'India'
  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean)

  return {
    location: normalized,
    city: parts[0] || null,
    state: parts.length >= 3 ? parts[1] : null,
    country: parts[parts.length - 1] || 'India',
  }
}

const extractDescription = (html) => {
  const descriptionBlock = String(html ?? '').match(
    /<div[^>]+class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )?.[1]

  return stripTags(descriptionBlock)
}

const extractSlug = (url) => {
  const pathname = new URL(url).pathname.replace(/\/+$/, '')
  const segments = pathname.split('/').filter(Boolean)
  return segments.at(-1) || null
}

export const extractListings = (html) => [...String(html ?? '').matchAll(
  /<article\b[\s\S]*?<a[^>]+href=["']([^"']*\/company\/career\/[^"']+)["'][^>]*>[\s\S]*?<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>[\s\S]*?<\/article>/gi,
)].map((match) => {
  const sourceUrl = absoluteUrl(match[1])
  const title = stripTags(match[2])
  const articleHtml = match[0]
  const locationText = stripTags(
    articleHtml.match(/<[^>]+class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1],
  ) || stripTags(articleHtml.match(/<p[^>]*>([\s\S]*?India[\s\S]*?)<\/p>/i)?.[1])

  if (!sourceUrl || !title || !locationText) return null

  return {
    title,
    ...extractLocationParts(locationText),
    sourceUrl,
  }
}).filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const normalizedHtml = String(html ?? '')
  const title = stripTags(normalizedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || listing.title
  const locationText = stripTags(normalizedHtml.match(/<p[^>]*>([\s\S]*?India[\s\S]*?)<\/p>/i)?.[1]) || listing.location
  const department = normalizeWhitespace(normalizedHtml.match(/Department\s*:\s*([^<\n\r]+)/i)?.[1]) || null
  const experienceRequired = normalizeWhitespace(normalizedHtml.match(/Experience\s*:\s*([^<\n\r]+)/i)?.[1]) || null
  const applyUrl = normalizeWhitespace(normalizedHtml.match(/<a[^>]+href=["'](mailto:[^"']+)["'][^>]*>/i)?.[1]) || null
  const jobId = extractSlug(listing.sourceUrl)
  const location = extractLocationParts(locationText)

  return {
    title,
    ...location,
    jobId,
    requisitionId: jobId,
    sourceUrl: listing.sourceUrl || null,
    applyUrl,
    department,
    employmentType: null,
    experienceRequired,
    postingDate: null,
    closingDate: null,
    jobDescription: extractDescription(normalizedHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createIgusIndiaScraper = ({ maxJobs = null } = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())
    const listings = extractListings(await fetchText(CAREERS_URL))
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings

    const jobs = []
    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)
      jobs.push({
        ...detail,
        company: 'igus India',
        link: detail.applyUrl || detail.sourceUrl,
        source: 'igusindia',
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createIgusIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'igusindia')
}
