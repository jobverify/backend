import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://sahaj.ai'
export const CAREERS_URL = `${BASE_URL}/careers/`
export const SOURCE = 'sahajai'
export const COMPANY = 'Sahaj AI'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#8217;|&rsquo;|&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|article|main|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n+/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join(' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtml(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (value) => {
  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

const isJobDetailUrl = (value) => {
  if (!value) return false

  try {
    const parsed = new URL(value)
    return /(^|\.)sahaj\.ai$/i.test(parsed.hostname)
      && /^\/joinus\/[^/]+\/?$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractSectionHtml = (html, heading) => {
  const match = String(html ?? '').match(
    new RegExp(`<h2\\b[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h2>([\\s\\S]*?)(?=<h2\\b[^>]*>|$)`, 'i'),
  )

  return match?.[1] || null
}

const extractLocation = (html) => normalizeWhitespace(
  String(html ?? '').match(/Location:\s*([^<\n\r]+)/i)?.[1],
)

const deriveCity = (location) => normalizeWhitespace(String(location ?? '').split('|')[0])

const buildJobDescription = (html) => {
  const sections = [
    'About the role and the skill set',
    'About the role',
    'Responsibilities',
    'Additional Responsibilities',
    'Skills you’ll need',
    'Give yourself an opportunity to',
  ]
    .map((heading) => {
      const sectionHtml = extractSectionHtml(html, heading)
      if (!sectionHtml) return null
      return `${heading} ${stripTags(sectionHtml)}`
    })
    .filter(Boolean)

  return normalizeWhitespace(sections.join(' '))
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s+Sahaj\s+Software\s*<\/title>/i.test(page)
    && /Work will never be the same again!/i.test(page)
    && /Explore Open Roles/i.test(page)
    && /href=["'](?:https:\/\/sahaj\.ai)?\/joinus\/[^/"'#?]+\/["']/i.test(page)
}

export const extractListings = (html) => {
  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>\s*Know More\s*<\/a>/gi)) {
    const title = normalizeWhitespace(match[1])
    const sourceUrl = toAbsoluteUrl(match[2])
    const jobId = slugFromUrl(sourceUrl)

    if (!title || !sourceUrl || !jobId || !isJobDetailUrl(sourceUrl) || seen.has(sourceUrl)) continue

    seen.add(sourceUrl)
    jobs.push({
      title,
      sourceUrl,
      applyUrl: sourceUrl,
      jobId,
      requisitionId: jobId,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    String(html ?? '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ) || listing.title || null
  const location = extractLocation(html)

  return {
    title,
    location,
    city: deriveCity(location),
    country: location && /\b(Bengaluru|Chennai|Hyderabad|Pune)\b/i.test(location) ? 'India' : null,
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: null,
    experienceRequired: null,
    department: null,
    minimumQualification: stripTags(extractSectionHtml(html, 'Qualification/experience:')),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(html),
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

export const createSahajAiScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('verified Sahaj AI careers surface no longer matches the official public careers page')
    }

    const listings = extractListings(careersHtml)
    if (listings.length === 0) {
      throw new Error('verified Sahaj AI careers surface no longer exposes public same-domain job links')
    }

    const jobs = []
    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        company: COMPANY,
        source: SOURCE,
        link: listing.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createSahajAiScraper().run(options)

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
