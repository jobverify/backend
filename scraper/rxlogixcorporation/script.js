import path from 'node:path'
import { fileURLToPath } from 'node:url'

import RX_LOGIX_CORPORATION_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = RX_LOGIX_CORPORATION_CATALOG.source
export const COMPANY = RX_LOGIX_CORPORATION_CATALOG.companyName
export const CAREERS_URL = RX_LOGIX_CORPORATION_CATALOG.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const absoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const inferCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null
const extractPageTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title>\s*([\s\S]*?)\s*<\/title>/i)?.[1] ?? null)

const extractMetaDescription = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"]+)["']/i)?.[1] ?? null)

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
) || ''

export const hasOfficialRxLogixCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Careers at RxLogix\s*\|\s*Join Our Team\s*<\/title>/i.test(page)
    && /Interested to join our growing team\?\s*Browse our current openings:/i.test(text)
    && /class=["'][^"']*\bjob_tab\b/i.test(page)
    && /Technical Architect/i.test(text)
    && /Noida,\s*India/i.test(text)
}

export const extractCareerListings = (html) => {
  if (!hasOfficialRxLogixCareersSignal(html)) {
    throw new Error('RxLogix verified first-party careers page no longer matches the trusted openings surface')
  }

  const listings = []

  for (const sectionMatch of String(html ?? '').matchAll(/<h2>\s*([\s\S]*?)\s*<\/h2>([\s\S]*?)(?=<h2>|<\/body>|$)/gi)) {
    const department = normalizeWhitespace(sectionMatch[1]) || null
    const sectionHtml = sectionMatch[2]

    for (const anchorMatch of String(sectionHtml ?? '').matchAll(/<a\b[^>]*href="([^"]+)"[^>]*class=["'][^"']*\bjob_tab\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const sourceUrl = absoluteUrl(anchorMatch[1])
      const anchorHtml = anchorMatch[2]
      const title = normalizeWhitespace(anchorHtml.match(/<div[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? anchorHtml)
      const location = normalizeWhitespace(anchorHtml.match(/<div[^>]*class=["'][^"']*\bloc\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? null)
      const jobId = (() => {
        try {
          const pathnameParts = new URL(sourceUrl).pathname.split('/').filter(Boolean)
          return pathnameParts.at(-1) || null
        } catch {
          return null
        }
      })()

      if (!sourceUrl || !title || !location || !jobId || !/india/i.test(location)) continue

      listings.push({
        jobId,
        requisitionId: jobId,
        title,
        department,
        location,
        city: inferCity(location),
        country: 'India',
        sourceUrl,
      })
    }
  }

  return listings
}

const extractTitle = (html) => {
  const pageTitle = extractPageTitle(html)
  if (pageTitle) {
    return normalizeWhitespace(pageTitle.replace(/\s*-\s*Rxlogix\s*$/i, ''))
  }

  const match = /<h1>\s*([\s\S]*?)\s*<\/h1>/i.exec(String(html ?? ''))
  return match ? normalizeWhitespace(match[1]) : null
}

const extractDescription = (html) => {
  const metaDescription = extractMetaDescription(html)
  if (metaDescription) return metaDescription

  const text = stripTags(html)
  const match = text.match(
    /\b(?:General Purpose|Role Overview|Job Summary)\b[:\s-]*(.+?)(?=\b(?:Key Responsibilities|Minimum Requirements|Requirements|Qualifications?)\b|$)/i,
  )
  return match ? normalizeWhitespace(match[1]) : null
}

const extractExperience = (html) => {
  const haystack = `${extractMetaDescription(html) || ''} ${stripTags(html)}`
  const match = haystack.match(/\b(\d+(?:\s*-\s*\d+)?\+?\s*years)\b/i)
  return match ? normalizeWhitespace(match[1]) : null
}

export const extractCareerDetail = (html, listing = {}) => ({
  jobId: listing.jobId,
  requisitionId: listing.requisitionId,
  title: extractTitle(html) || listing.title,
  company: COMPANY,
  department: listing.department || null,
  location: listing.location,
  city: inferCity(listing.location),
  country: 'India',
  sourceUrl: listing.sourceUrl,
  applyUrl: listing.sourceUrl,
  employmentType: null,
  experienceRequired: extractExperience(html),
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: extractDescription(html) || `Official RxLogix careers detail for ${listing.title}.`,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createRxLogixCorporationScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString() } = {}) {
    const page = await fetchPage(CAREERS_URL)
    const listings = extractCareerListings(page.html)
    const jobs = []

    for (const listing of listings) {
      const detailPage = await fetchPage(listing.sourceUrl)
      const job = extractCareerDetail(detailPage.html, listing)
      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createRxLogixCorporationScraper().run(options)

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
