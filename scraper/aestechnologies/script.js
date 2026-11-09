import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://careers.advanceecomsolutions.com/careers'
const CAREER_PAGE_ORIGIN = new URL(CAREER_PAGE_URL).origin

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
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

const stripTagsWithLineBreaks = (value) => {
  const normalized = String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n+/g, '\n')

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.join('\n')
}

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return new URL(normalized, `${CAREER_PAGE_ORIGIN}/`).toString()
}

const normalizeTitle = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\s*\([^)]*\)\s*$/, ''),
)

export const buildSearchUrl = () => CAREER_PAGE_URL

export const pageIndicatesJobs = (html) => (
  /Current Openings/i.test(String(html ?? ''))
  && /job-detail\/\d+/i.test(String(html ?? ''))
)

export const pageIndicatesOfficialCareersSurface = (html) => {
  const page = String(html ?? '')

  return /Current Openings/i.test(page)
    && /AES provides IT services,\s*business solutions and outsourcing/i.test(stripTags(page))
}

export const extractListings = (html) => {
  const matches = String(html ?? '').matchAll(
    /<a href="([^"]*job-detail\/(\d+))">\s*<b[^>]*>([\s\S]*?)<\/b>\s*<\/a>/gi,
  )

  return Array.from(matches, ([, detailUrl, requisitionId, rawTitle]) => ({
    title: normalizeTitle(stripTags(rawTitle)),
    detailUrl: toAbsoluteUrl(detailUrl),
    requisitionId,
  }))
}

export const extractJobDetail = (html, listing) => {
  const detailTitle = normalizeTitle(
    stripTags(
      String(html ?? '').match(/<a href="[^"]*apply-job\/\d+">\s*<b>([\s\S]*?)<\/b>\s*<\/a>/i)?.[1],
    ),
  ) || listing.title
  const applyUrl = toAbsoluteUrl(
    String(html ?? '').match(/<a href="([^"]*apply-job\/\d+)"/i)?.[1],
  )
  const detailBodyHtml = String(html ?? '').match(/<div class="careers-details">([\s\S]*?)<\/div>/i)?.[1] || ''
  const detailBodyWithoutActions = detailBodyHtml
    .replace(/<a href="[^"]*apply-job\/\d+">[\s\S]*?<\/a>/gi, '')
  const detailsText = stripTagsWithLineBreaks(detailBodyWithoutActions)
  const jobDescription = normalizeWhitespace(
    `${detailsText || 'Apply via the AES Technologies careers page.'} Apply via the AES Technologies careers page.`,
  )
  const isRemote = /\[Remote\]/i.test(detailTitle) || /\bremote\b/i.test(jobDescription)

  return {
    title: detailTitle,
    company: 'AES Technologies',
    department: detailTitle,
    location: isRemote ? 'Remote, India' : 'India',
    city: null,
    country: 'India',
    jobId: `aestechnologies-${listing.requisitionId}`,
    requisitionId: listing.requisitionId,
    sourceUrl: CAREER_PAGE_URL,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
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

export const createAesTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const listingHtml = await fetchText(buildSearchUrl())
    const listings = extractListings(listingHtml)

    if (listings.length === 0) {
      if (pageIndicatesOfficialCareersSurface(listingHtml)) {
        return []
      }

      throw new Error('AES Technologies careers page no longer exposes the expected job links')
    }

    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.detailUrl)
      jobs.push(extractJobDetail(detailHtml, listing))
    }

    return jobs.map((job) => ({
      ...job,
      source: 'aestechnologies',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAesTechnologiesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AES Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'aestechnologies')
    console.log('DB result:', result)
    process.exit(0)
  }
}
