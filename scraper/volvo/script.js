import {createNativeScraper,nativeMetadata} from './native.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.volvogroup.com/en/careers.html'
export const JOBS_URL = 'https://jobs.volvogroup.com/en'
export const INDIA_SEARCH_URL = 'https://jobs.volvogroup.com/search/?q=&locationsearch=India'
export const RSS_URL = 'https://jobs.volvogroup.com/services/rss/job/?locale=en_US&keywords=(India)'

const COMPANY = 'Volvo Group'
const SOURCE = 'volvo'
const INDIA_PATTERN = /\bindia\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const extractTag = (item, tag) => normalizeWhitespace(
  item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1],
)

const parseListingUrl = (value) => {
  const match = String(value ?? '').match(/\/job\/([^/]+)\/(\d+)\/?$/i)
  return match ? { slug: match[1], jobId: match[2] } : null
}

export const buildSearchUrl = () => INDIA_SEARCH_URL

export const buildDetailUrl = ({ slug, jobId }) =>
  `${JOBS_URL.replace(/\/en$/, '')}/job/${encodeURIComponent(slug)}/${encodeURIComponent(jobId)}/`

export const buildApplyUrl = ({ jobId }) =>
  `${JOBS_URL.replace(/\/en$/, '')}/talentcommunity/apply/${encodeURIComponent(jobId)}/?locale=en_US`

export const normalizeListings = (listings = []) => listings
  .map((listing) => {
    const location = normalizeWhitespace(listing.location || listing.country)
    const city = normalizeWhitespace(listing.city || location.split(',')[0]) || null

    return {
      title: normalizeWhitespace(listing.title),
      location,
      city,
      jobId: normalizeWhitespace(listing.jobId || listing.id),
      slug: normalizeWhitespace(listing.slug),
    }
  })
  .filter((listing) => listing.title && listing.jobId && listing.slug && INDIA_PATTERN.test(listing.location))

export const buildJob = (listing) => {
  const sourceUrl = buildDetailUrl(listing)
  const applyUrl = buildApplyUrl(listing)

  return {
    ...listing,
    company: COMPANY,
    source: SOURCE,
    country: 'India',
    sourceUrl,
    applyUrl,
    link: applyUrl,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const extractRssListings = (xml) => [...String(xml ?? '').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
  .map(([, item]) => {
    const parsedUrl = parseListingUrl(extractTag(item, 'link') || extractTag(item, 'guid'))
    if (!parsedUrl) return null

    return {
      ...parsedUrl,
      title: extractTag(item, 'title'),
      location: extractTag(item, 'category') || extractTag(item, 'description'),
    }
  })
  .filter(Boolean)

export const run = async (options = {}) => createNativeScraper().run(options)

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    ...nativeMetadata,
    baseUrl: JOBS_URL,
    adapter: 'script',
  },
})

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
