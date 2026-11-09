import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'buildnext'
export const COMPANY = 'BuildNext Construction Solutions (P) Ltd'
export const CAREERS_PAGE_URL = 'https://careers.buildnext.in/jobs/'
export const JOBS_FEED_URL = 'https://careers.buildnext.in/jobs/feed/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_PAGE_URL).toString().replace(/^http:\/\/careers\.buildnext\.in/i, 'https://careers.buildnext.in')
  } catch {
    return normalized.replace(/^http:\/\/careers\.buildnext\.in/i, 'https://careers.buildnext.in')
  }
}

const toIsoDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n'),
)

const extractTagValue = (xml, tagName) => (
  xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'))?.[1] || null
)

const extractJobId = (url) => normalizeUrl(url)?.match(/-(\d+)\/?$/)?.[1] || null

export const extractFeedItems = (feedXml) =>
  [...String(feedXml ?? '').matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map(([, itemXml]) => {
      const sourceUrl = normalizeUrl(extractTagValue(itemXml, 'link'))
      const jobId = extractJobId(sourceUrl)
      const title = normalizeWhitespace(extractTagValue(itemXml, 'title'))

      if (!sourceUrl || !jobId || !title) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location: null,
        city: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: null,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDate(extractTagValue(itemXml, 'pubDate')),
        closingDate: null,
        jobDescription: normalizeWhitespace(extractTagValue(itemXml, 'description')),
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

export const extractJobDetail = (detailHtml, listing) => {
  const html = String(detailHtml ?? '')
  const applyUrl = normalizeUrl(
    html.match(/data-apply-url=["']([^"']+)["']/i)?.[1]
    || html.match(/<a[^>]+class=["'][^"']*application_button[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1],
  )
  const location = normalizeWhitespace(
    html.match(/<div[^>]*class=["'][^"']*job_listing-location[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
  )
  const city = normalizeCity(location?.split(',')[0]?.trim() || null)
  const jobDescription = stripHtml(
    html.match(/<div[^>]*class=["'][^"']*job_description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
  ) || listing.jobDescription

  return {
    ...listing,
    applyUrl: applyUrl || listing.sourceUrl,
    location: location || listing.location,
    city: city || listing.city,
    jobDescription,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/rss+xml,application/xml,text/html;q=0.9,text/plain;q=0.8,*/*;q=0.7',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createBuildNextScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const feedXml = await fetchText(JOBS_FEED_URL)
    const listings = extractFeedItems(feedXml)
    const selectedListings = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings

    const jobs = await Promise.all(selectedListings.map(async (listing) => {
      const detailHtml = await fetchText(listing.sourceUrl)
      const job = extractJobDetail(detailHtml, listing)

      return {
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }
    }))

    return jobs
  },
})

export const run = async (options = {}) => createBuildNextScraper().run(options)

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
