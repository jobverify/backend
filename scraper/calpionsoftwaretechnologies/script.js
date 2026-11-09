import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { CALPION_SOFTWARE_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CALPION_SOFTWARE_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeLocation = (value) => {
  const cleaned = normalizeWhitespace(value)
  if (!cleaned) return null

  if (/\bremote\b/i.test(cleaned)) return 'Remote, India'
  if (/\bbangalore\b|\bbengaluru\b/i.test(cleaned)) return 'Bengaluru, India'
  if (/\bcoimbatore\b/i.test(cleaned)) return 'Coimbatore, India'
  if (/\bindia\b/i.test(cleaned)) return cleaned.replace(/\s*,\s*/g, ', ')
  if (/\busa\b|\bunited states\b/i.test(cleaned)) return cleaned
  if (/\bphilippines\b|\bmanila\b/i.test(cleaned)) return cleaned

  return `${cleaned}, India`
}

const extractCityFromLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^remote\b/i.test(normalized)) return null
  if (/\bbangalore\b|\bbengaluru\b/i.test(normalized)) return 'Bengaluru'
  return normalizeCity(normalized.split(',')[0]) || normalized.split(',')[0].trim()
}

const getRemoteStatus = (value) => (/^remote\b/i.test(value || '') ? 'Remote' : 'On-site')

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'www.calpion.com') return null
    if (!/^\/career(?:\/|$)/i.test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
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

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Careers\s*(?:&|&amp;)\s*Job Opportunities\s*\|\s*Work Culture and Values\s*\|\s*Calpion\s*<\/title>/i.test(page)
    && normalized.includes('Opportunities with us')
    && normalized.includes('Know More')
    && normalized.includes('Apply Now')
    && (/\bcareer-card-featured\b/i.test(page) || /\bcareer-card\b/i.test(page))
  }

const extractModernCareerCards = (html = '') => Array.from(
  String(html ?? '').matchAll(
    /<div[^>]*class=["'][^"']*career-card-featured[^"']*["'][^>]*>([\s\S]*?)<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*button[^"']*w-button[^"']*["'][^>]*>\s*Apply Now\s*<\/a>/gi,
  ),
  (match) => ({
    cardHtml: match[1],
    applyUrl: toAbsoluteUrl(match[2]),
  }),
)

const extractLegacyCareerCards = (html = '') => Array.from(
  String(html ?? '').matchAll(/<div[^>]*class=["'][^"']*career-card[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi),
  (match) => ({
    cardHtml: match[1],
    applyUrl: toAbsoluteUrl(match[1].match(/<a[^>]*href=["']([^"']+)["']/i)?.[1]),
  }),
)

export const extractCareerCards = (html = '') => {
  const jobs = []
  const cardMatches = extractModernCareerCards(html)

  for (const { cardHtml, applyUrl } of (cardMatches.length > 0 ? cardMatches : extractLegacyCareerCards(html))) {
    const title = normalizeWhitespace(
      cardHtml.match(/<h3[^>]*class=["'][^"']*career-blog-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1]
      || cardHtml.match(/<div[^>]*class=["'][^"']*career-blog-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
      || cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1],
    )
    const summary = normalizeWhitespace(
      cardHtml.match(/<p[^>]*class=["'][^"']*career-card-des[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]
      || cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1],
    )

    if (!title || !applyUrl) continue

    jobs.push({
      title,
      summary: summary || `Apply via the first-party Calpion careers page for ${title}.`,
      sourceUrl: applyUrl,
      applyUrl,
    })
  }

  return jobs.filter((job, index, items) =>
    items.findIndex((candidate) => candidate.applyUrl === job.applyUrl) === index,
  )
}

const extractDetailFields = (html = '') => {
  const fields = new Map()

  for (const match of String(html ?? '').matchAll(/<p[^>]*>\s*<strong>\s*([^<]+?)\s*:?\s*<\/strong>\s*([\s\S]*?)<\/p>/gi)) {
    const label = normalizeWhitespace(match[1])?.toLowerCase().replace(/[^a-z0-9]+/g, '') || null
    const value = normalizeWhitespace(match[2])

    if (!label || !value) continue
    fields.set(label, value)
  }

  return fields
}

const extractJobSummary = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(
      /<h[1-6][^>]*>\s*Job Summary\s*<\/h[1-6]>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
    )?.[1],
  )

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('full-time') || normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

export const extractJobDetail = (html = '', listing = {}) => {
  const fields = extractDetailFields(html)
  const detailTitle = fields.get('jobtitle') || listing.title
  const location = normalizeLocation(fields.get('location') || null)

  return {
    title: detailTitle || listing.title,
    location,
    city: extractCityFromLocation(location),
    country: /\bindia\b/i.test(location || '') ? 'India' : null,
    employmentType: normalizeEmploymentType(
      fields.get('termsfulltimeparttimecontractual')
      || fields.get('mode')
      || null,
    ),
    experienceRequired: fields.get('experience') || null,
    jobDescription: extractJobSummary(html) || listing.summary,
    remoteStatus: getRemoteStatus(location),
  }
}

export const createCalpionSoftwareTechnologiesScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = defaultNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Calpion careers surface no longer matches the trusted first-party page')
    }

    const listings = extractCareerCards(careersHtml)
    const jobs = await Promise.all(listings.map(async (listing) => {
      try {
        const detailHtml = await fetchText(listing.applyUrl)
        return {
          ...listing,
          ...extractJobDetail(detailHtml, listing),
        }
      } catch (error) {
        console.warn(`  [${SOURCE}] Failed to enrich ${listing.applyUrl}: ${error.message}`)
        return listing
      }
    }))

    return jobs
      .filter((job) => !job.location || /\bindia\b/i.test(job.location))
      .map((job) => {
        const location = job.location || 'India'
        const city = job.city || extractCityFromLocation(location)
        const title = job.title || 'Unknown Role'

        return {
          title,
          company: COMPANY,
          department: null,
          location,
          city,
          country: /\bindia\b/i.test(location) ? 'India' : null,
          jobId: slugify(title),
          requisitionId: slugify(title),
          sourceUrl: job.sourceUrl,
          applyUrl: job.applyUrl,
          employmentType: job.employmentType || null,
          experienceRequired: job.experienceRequired || null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: null,
          closingDate: null,
          jobDescription: job.jobDescription || job.summary,
          remoteStatus: job.remoteStatus || getRemoteStatus(location),
          source: SOURCE,
          link: job.applyUrl,
          scrapedAt: now(),
        }
      })
  },
})

export const run = async (options = {}) => createCalpionSoftwareTechnologiesScraper().run(options)

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
