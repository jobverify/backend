import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.zf.com/mobile/en/careers/careers.html'
export const JOBS_URL = 'https://jobs.zf.com'
export const INDIA_SEARCH_URL = 'https://jobs.zf.com/search/?createNewAlert=false&q=&locationsearch=India&locale=en_US'

const COMPANY = 'ZF Group'
const SOURCE = 'zf'

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), JOBS_URL).toString()
  } catch {
    return null
  }
}

const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const buildIndiaSearchUrl = () => INDIA_SEARCH_URL

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(/<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => {
    const rowHtml = match[1]
    const title = normalizeWhitespace(
      extractFirst(/<a[^>]*class=["'][^"']*jobTitle-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i, rowHtml),
    )
    const relativeLink = normalizeWhitespace(
      extractFirst(/<a(?=[^>]*class=["'][^"']*jobTitle-link[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i, rowHtml),
    )
    const location = normalizeWhitespace(
      extractFirst(/<span[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, rowHtml),
    )
    const sourceUrl = toAbsoluteUrl(relativeLink)
    const jobId = extractJobIdFromUrl(sourceUrl)

    if (!title || !location || !sourceUrl || !jobId) return null

    return {
      title,
      location,
      city: extractCity(location),
      jobId,
      requisitionId: jobId,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/<(?:span|h1)\b[^>]*itemprop=["']title["'][^>]*>([\s\S]*?)<\/(?:span|h1)>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractFirst(
    /itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  ) || extractFirst(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>/i, html)
  const applyPath = normalizeWhitespace(
    extractFirst(/class=["'][^"']*\bapply\b[^"']*\bdialogApplyBtn\b[^"']*["'][^>]*href=["']([^"']+)["']/i, html),
  )
  const jobId = normalizeWhitespace(
    extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath),
  ) || listing.jobId || null
  const city = listing.city || normalizeWhitespace(
    extractFirst(/itemprop=["']addressLocality["']\s+content=["']([^"']+)["']/i, html),
  ) || null
  const postingDate = normalizeWhitespace(
    extractFirst(/itemprop=["']datePosted["']\s+content=["']([^"']+)["']/i, html),
  )
  const closingDate = normalizeWhitespace(
    extractFirst(/itemprop=["']validThrough["']\s+content=["']([^"']+)["']/i, html),
  )

  return {
    title,
    location: listing.location || null,
    city,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate,
    closingDate,
    applyUrl: toAbsoluteUrl(applyPath),
    sourceUrl: listing.sourceUrl || null,
  }
}

const defaultFetchText = async (url) => {
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

export const createZfScraper = () => ({
  async run({
    maxPages = config.maxPages,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()
    let pageNumber = 1

    while (pageNumber <= maxPages) {
      const listingHtml = await fetchText(buildIndiaSearchUrl())
      const listings = extractSearchResults(listingHtml)

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
          company: COMPANY,
          department: null,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.sourceUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || null,
          closingDate: detail.closingDate || null,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      break
    }

    return jobs
  },
})

export const run = async (options = {}) => createZfScraper().run(options)

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
