import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import APPINVENTIV_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = APPINVENTIV_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const getMailtoApplyUrl = (html = '') => {
  const match = String(html ?? '').match(/career@appinventiv\.com/i)
  return match ? 'mailto:career@appinventiv.com' : null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(page) || ''

  return /<title>\s*Careers at Appinventiv\s*\|\s*Build the Future of Digital\s*<\/title>/i.test(page)
    && normalized.includes('Trending Opportunities')
    && normalized.includes('AL/ML Engineer')
    && normalized.includes('Tech Lead Node.js')
    && normalized.includes('career@appinventiv.com')
}

export const extractListings = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(
      /<a\b[^>]*class=["'][^"']*job-desc-button[^"']*["'][^>]*data-target=["']#([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    ),
  )
    .map((match) => {
      const modalId = normalizeWhitespace(match[1])
      const body = match[2]
      const title = stripTags(body.match(/<span\b[^>]*class=["'][^"']*pos-name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1])
      const locationLabel = stripTags(body.match(/<span\b[^>]*class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1])

      if (!modalId || !title || !locationLabel) return null

      return { modalId, title, locationLabel }
    })
    .filter(Boolean)

const extractModalHtml = (html = '', modalId) =>
  String(html ?? '').match(new RegExp(`<div\\b[^>]*id=["']${modalId}["'][\\s\\S]*?<\\/div>\\s*<\\/div>`, 'i'))?.[0]
  || null

const extractModalDescription = (modalHtml = '') =>
  stripTags(modalHtml.match(/<h3\b[^>]*>\s*About the role\s*<\/h3>\s*<p>([\s\S]*?)<\/p>/i)?.[1])

const extractModalExperience = (modalHtml = '') =>
  normalizeWhitespace(
    stripTags(modalHtml.match(/<h5>\s*Experience\s*:\s*([\s\S]*?)<\/h5>/i)?.[1]),
  )

const extractModalSkills = (modalHtml = '') =>
  Array.from(
    String(modalHtml ?? '').matchAll(
      /<h3\b[^>]*>\s*What you'll need\s*<\/h3>[\s\S]*?<ul>([\s\S]*?)<\/ul>/gi,
    ),
  )
    .flatMap((match) => Array.from(match[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)))
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractJobId = (modalId) => String(modalId ?? '').match(/(\d+)$/)?.[1] || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (value) => normalizeWhitespace(value)?.split(',')[0] || null

const mapListingToJob = (listing, html, scrapedAt) => {
  const modalHtml = extractModalHtml(html, listing.modalId)
  const jobId = extractJobId(listing.modalId)
  const sourceUrl = `${CAREERS_URL}#${listing.modalId}`
  const applyUrl = getMailtoApplyUrl(html)

  if (!modalHtml || !jobId || !applyUrl) return null

  return {
    title: listing.title,
    company: COMPANY,
    department: null,
    location: normalizeLocation(listing.locationLabel),
    city: extractCity(listing.locationLabel),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: 'Full-time',
    experienceRequired: extractModalExperience(modalHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractModalSkills(modalHtml),
    postingDate: null,
    closingDate: null,
    jobDescription: extractModalDescription(modalHtml),
    remoteStatus: 'On-site',
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

export const createAppInventivTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified AppInventiv Technologies careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractListings(careersHtml)
      .map((listing) => mapListingToJob(listing, careersHtml, now()))
      .filter(Boolean)

    if (jobs.length === 0) {
      throw new Error('The verified AppInventiv Technologies careers page no longer exposes normalized embedded job modals')
    }

    return jobs
  },
})

export const run = async (options = {}) => createAppInventivTechnologiesScraper(options).run(options)

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
