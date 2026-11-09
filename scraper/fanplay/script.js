import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://fanplayiot.com/?page_id=834'

const COMPANY = 'Fanplay'
const SOURCE = 'fanplay'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
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

const parseLocation = (value) => {
  const city = normalizeWhitespace(value)
  if (!city) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  return {
    location: `${city}, India`,
    city,
    country: 'India',
  }
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(`${normalized} UTC`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const getSpecification = (card, type) => stripTags(
  card.match(new RegExp(
    `<div\\b[^>]*class=["'][^"']*awsm-job-specification-${type}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
    'i',
  ))?.[1],
)

export const pageIndicatesFanplayCareers = (html) => {
  const page = String(html ?? '')
  return (
    /Join Our Team/i.test(page)
    && /awsm-job-listings/i.test(page)
    && /fanplayiot\.com/i.test(page)
  )
}

export const extractJobCards = (html) => {
  if (!pageIndicatesFanplayCareers(html)) {
    throw new Error('Fanplay careers page no longer exposes the expected public job listings')
  }

  const cards = String(html ?? '').match(
    /<div\b[^>]*class=["'][^"']*awsm-job-listing-item[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi,
  ) || []

  const jobs = cards.map((card) => {
    const jobId = normalizeWhitespace(card.match(/id=["']awsm-list-item-(\d+)["']/i)?.[1])
    const sourceUrl = normalizeWhitespace(card.match(/<a[^>]+href=["']([^"']*\?awsm_job_openings=[^"']+)["'][^>]*>/i)?.[1])
    const title = stripTags(card.match(/<h2\b[^>]*class=["'][^"']*\bawsm-job-post-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    const department = getSpecification(card, 'job-category')
    const locationData = parseLocation(getSpecification(card, 'job-location'))

    if (!jobId || !sourceUrl || !title || !locationData.location) return null

    return {
      title,
      company: COMPANY,
      department,
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
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    }
  }).filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Fanplay careers page no longer exposes the expected public job listings')
  }

  return jobs
}

const extractSectionText = (html, heading) => {
  const match = String(html ?? '').match(new RegExp(
    `${heading}[\\s\\S]*?(?=<h[1-6][^>]*>|<p>Job Category:|<h2>Apply for this position|$)`,
    'i',
  ))

  return stripTags(match?.[0])?.replace(new RegExp(`^${heading}\\s*`, 'i'), '') || null
}

const extractListItems = (html, heading) => {
  const match = String(html ?? '').match(new RegExp(
    `${heading}[\\s\\S]*?<ul>([\\s\\S]*?)<\\/ul>`,
    'i',
  ))?.[1]

  return [...String(match ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => stripTags(item[1]))
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || listing.title || null
  const department = normalizeWhitespace(String(html ?? '').match(/Job Category:\s*([^<\n]+)/i)?.[1]) || listing.department || null
  const employmentType = normalizeWhitespace(String(html ?? '').match(/Job Type:\s*([^<\n]+)/i)?.[1]) || listing.employmentType || null
  const locationData = parseLocation(String(html ?? '').match(/Job Location:\s*([^<\n]+)/i)?.[1] || listing.city)
  const postingDate = toIsoDate(String(html ?? '').match(/By[\s\S]*?\/\s*([^<\n]+)/i)?.[1])
  const requiredSkills = [
    ...extractListItems(html, 'Responsibilities'),
    ...extractListItems(html, 'Requirements and skills'),
  ]
  const description = [
    extractSectionText(html, 'Job Description'),
    extractSectionText(html, 'Responsibilities'),
    extractSectionText(html, 'Requirements and skills'),
  ].filter(Boolean).join(' ')

  return {
    ...listing,
    title,
    company: COMPANY,
    department,
    location: locationData.location || listing.location || null,
    city: locationData.city || listing.city || null,
    country: locationData.country || listing.country || 'India',
    applyUrl: listing.sourceUrl || listing.applyUrl || null,
    employmentType,
    requiredSkills,
    postingDate,
    jobDescription: normalizeWhitespace(description),
    remoteStatus: 'On-site',
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createFanplayScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchListingHtml,
    now = () => new Date().toISOString(),
  } = {}) {
    if (!fetchListingHtml) {
      fetchListingHtml = async () => fetchText(CAREERS_URL)
    }

    const listingHtml = await fetchListingHtml()
    const listings = extractJobCards(listingHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createFanplayScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Fanplay jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
