import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://www.emtensor.com'
export const CAREERS_URL = `${BASE_URL}/about-us/recruitment/`

const SOURCE = 'emtensor'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&raquo;/gi, '')
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/[–—]/g, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (url) => {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

const titleFromSlug = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/-/g, ' ')
    .replace(/\b[a-z]/g, (match) => match.toUpperCase()),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /The following job positions are available:/i.test(page)
    && /EMTensor|emtensor/i.test(page)
    && /href=["'][^"']*\/about-us\/recruitment\/[^"']+\/["']/i.test(page)
    && /Learn More/i.test(page)
}

const isLearnMoreText = (value) => /^learn more\b/i.test(normalizeWhitespace(value) || '')

const findPreviousHeadingTitle = (html, index) => {
  const headings = [...String(html ?? '')
    .slice(Math.max(0, index - 2500), index)
    .matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)]

  if (headings.length === 0) return null

  return normalizeWhitespace(headings[headings.length - 1][1])
}

export const extractListings = (html) => {
  const page = String(html ?? '')
  const jobs = []
  const seen = new Set()

  for (const match of page.matchAll(/<a[^>]+href=["']([^"']*\/about-us\/recruitment\/[^"']+\/)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const anchorText = normalizeWhitespace(match[2])
    const jobId = slugFromUrl(sourceUrl)
    const title = isLearnMoreText(anchorText)
      ? (findPreviousHeadingTitle(page, match.index) || titleFromSlug(jobId))
      : anchorText?.replace(/\s*Learn More\s*>?$/i, '')

    if (!sourceUrl || sourceUrl === CAREERS_URL || !title || !jobId || seen.has(sourceUrl)) continue
    seen.add(sourceUrl)

    jobs.push({
      title,
      company: 'EMTensor',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
    })
  }

  return jobs
}

const contentBeforeFooter = (html) => String(html ?? '').split(/Sonnenallee|Privacy\s*&\s*Cookie|This site uses functional cookies/i)[0]

const extractLabeledValue = (text, label) => {
  const pattern = new RegExp(
    `\\b${label}\\s*:\\s*([\\s\\S]*?)(?=\\s+(?:Employment Type|About(?:\\s+the\\s+Role)?|About emtensor|Role Overview|Responsibilities|Requirements|Education|How to Apply)\\b|$)`,
    'i',
  )
  return normalizeWhitespace(pattern.exec(text)?.[1] ?? null)
}

const normalizeLocation = (value, jobText) => {
  const explicitLocation = normalizeWhitespace(value)
  const searchable = explicitLocation || normalizeWhitespace(jobText) || ''

  if (/\b(?:bangalore|bengaluru)\b/i.test(searchable)) {
    const suffix = /\(on-site\s*\/\s*hybrid\)/i.test(searchable) ? ' (On-site / Hybrid)' : ''
    return {
      location: /\bvienna\b/i.test(searchable)
        ? 'Vienna / Bengaluru, India'
        : `Bengaluru, India${suffix}`,
      city: 'Bengaluru',
      country: 'India',
    }
  }

  if (/\bvienna(?:-based)?\b/i.test(searchable)) {
    return {
      location: 'Vienna, Austria',
      city: 'Vienna',
      country: 'Austria',
    }
  }

  return {
    location: null,
    city: null,
    country: null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const contentHtml = contentBeforeFooter(html)
  const contentText = stripTags(contentHtml) || ''
  const title = normalizeWhitespace(
    extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, contentHtml),
  ) || listing.title || null

  const description = stripTags(
    extractFirst(
      /About(?:\s+the\s+Role| emtensor)[\s\S]*$/i,
      contentHtml,
      (match) => match[0],
    ) || contentHtml,
  )
  const locationData = normalizeLocation(extractLabeledValue(contentText, 'Location'), contentText)

  return {
    title,
    company: 'EMTensor',
    department: null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.sourceUrl || null,
    employmentType: extractLabeledValue(contentText, 'Employment Type'),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    remoteStatus: 'On-site',
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEmtensorScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('EMTensor careers page no longer matches the verified official public jobs surface')
    }

    const listings = extractListings(careersHtml)

    const jobs = await Promise.all(listings.map(async (listing) => {
      const detailHtml = await fetchText(listing.sourceUrl)
      return {
        ...extractJobDetail(detailHtml, listing),
        link: listing.sourceUrl,
        source: SOURCE,
        scrapedAt: new Date().toISOString(),
      }
    }))

    return jobs
  },
})

export const run = async (options = {}) => createEmtensorScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EMTensor scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
