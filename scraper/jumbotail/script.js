import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jumbotail'
export const COMPANY = 'Jumbotail'
export const CAREERS_PAGE_URL = 'https://jumbotail.com/careers/'
export const APPLICATION_EMAIL = 'mission@jumbotail.com'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

export const toCanonicalCareerUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  const slugMatch = absoluteUrl.match(/\/(?:careers|job)\/([^/?#]+)\/?$/i)
  if (!slugMatch?.[1]) return null

  return `https://jumbotail.com/careers/${slugMatch[1]}/`
}

const extractLocationFromCard = (cardHtml) => {
  const paragraphMatches = [...String(cardHtml ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return paragraphMatches.find((value) => /india/i.test(value)) || paragraphMatches[0] || null
}

export const extractJobListings = (html) => {
  const cardMatches = [...String(html ?? '').matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)]
  const cards = cardMatches.length > 0
    ? cardMatches.map((match) => match[1])
    : [String(html ?? '')]

  const jobs = cards.map((cardHtml) => {
    const anchorMatch = cardHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!anchorMatch) return null

    const sourceUrl = toCanonicalCareerUrl(anchorMatch[1])
    const title = stripTags(anchorMatch[2])
    if (!sourceUrl || !title) return null

    const location = extractLocationFromCard(cardHtml)
    if (!location || !/\bindia\b/i.test(location)) return null

    const slug = sourceUrl.match(/\/careers\/([^/]+)\/$/i)?.[1] || slugify(title)
    if (!slug) return null

    return {
      title,
      location,
      city: normalizeCity(location.split(',')[0]?.trim()),
      country: 'India',
      jobId: slug,
      requisitionId: slug,
      sourceUrl,
      applyUrl: APPLICATION_URL,
    }
  }).filter(Boolean)

  return jobs.filter((job, index, array) => array.findIndex((item) => item.sourceUrl === job.sourceUrl) === index)
}

const extractDepartment = (html) => {
  const metaMatch = String(html ?? '').match(/<div\b[^>]*class=["'][^"']*job-meta[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
  if (!metaMatch) return null

  const values = [...metaMatch[1].matchAll(/<(?:span|div|p)\b[^>]*>([\s\S]*?)<\/(?:span|div|p)>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return values.find((value) => !/\bindia\b/i.test(value)) || null
}

const extractJobDescription = (html) => {
  const detailHtml = String(html ?? '')
  const sectionMatches = [...detailHtml.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  if (sectionMatches.length > 0) {
    return sectionMatches.join(' ')
  }

  const mainMatch = detailHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  return stripTags(mainMatch?.[1] || detailHtml)
}

export const extractJobDetail = (html) => ({
  department: extractDepartment(html),
  jobDescription: extractJobDescription(html),
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createJumbotailScraper = ({ fetchText = defaultFetchText } = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const fetchImpl = overrideFetchText || fetchText
    const listingHtml = await fetchImpl(CAREERS_PAGE_URL)
    const listings = extractJobListings(listingHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchImpl(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml)

      jobs.push({
        ...listing,
        company: COMPANY,
        department: detail.department,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: detail.jobDescription,
        remoteStatus: null,
        source: SOURCE,
        link: listing.applyUrl || listing.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createJumbotailScraper().run(options)

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
