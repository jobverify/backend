import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

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
  const normalized = stripTags(page) || ''

  return /<title>\s*Join Us\s*-\s*Rajlaxmi\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && normalized.includes('Accountant')
    && normalized.includes('Bitrix24 Developer')
    && normalized.includes('ITSales Intern')
}

export const extractListings = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(
      /<article\b[^>]*class=["'][^"']*carrer-page-job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
    ),
  )
    .map((match) => {
      const block = match[1]
      const title = stripTags(block.match(/<h3\b[^>]*class=["'][^"']*carrer-page-job-head[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1])
      const locationLabel = stripTags(block.match(/<p\b[^>]*class=["'][^"']*carrer-page-job-loc[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
      const experienceLine = stripTags(block.match(/<p\b[^>]*class=["'][^"']*carrer-page-job-p[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
      const experienceLabel = normalizeWhitespace(
        String(experienceLine ?? '').replace(/^Experience Required:\s*/i, ''),
      )
      const descriptionItems = Array.from(block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
        .map((itemMatch) => stripTags(itemMatch[1]))
        .filter(Boolean)

      if (!title || !locationLabel || !experienceLabel) return null

      return {
        title,
        locationLabel,
        experienceLabel,
        descriptionItems,
      }
    })
    .filter(Boolean)

const toEmploymentType = (title) => (/intern/i.test(String(title ?? '')) ? 'Internship' : 'Full-time')

const normalizeLocation = (locationLabel) => {
  const normalized = normalizeWhitespace(locationLabel)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const mapListingToJob = (listing, scrapedAt) => {
  const title = normalizeWhitespace(listing?.title)
  const jobId = slugify(title)
  const sourceUrl = `${CAREERS_URL}#${jobId}`

  if (!title || !jobId) return null

  return {
    title,
    company: COMPANY,
    department: null,
    location: normalizeLocation(listing.locationLabel),
    city: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: toEmploymentType(title),
    experienceRequired: normalizeWhitespace(listing.experienceLabel),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace((listing.descriptionItems || []).join(' ')),
    remoteStatus: 'On-site',
    source: SOURCE,
    link: sourceUrl,
    scrapedAt,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

export const createRajlaxmiSolutionsPrivateLimitedScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Rajlaxmi Solutions Private Limited careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractListings(careersHtml)
      .map((listing) => mapListingToJob(listing, now()))
      .filter(Boolean)

    if (jobs.length === 0) {
      throw new Error('The verified Rajlaxmi Solutions Private Limited careers page no longer exposes normalized current openings')
    }

    return jobs
  },
})

export const run = async (options = {}) => createRajlaxmiSolutionsPrivateLimitedScraper(options).run(options)

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
