import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import NOCCARC_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = NOCCARC_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OUTBOUND_JOB_HOST = PROVIDER_METADATA.publicJobListingHost
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(String(value ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const extractJobsSection = (html = '') => {
  const rawHtml = String(html ?? '')
  const headingMatch = rawHtml.match(
    /<h1[^>]*>[\s\S]*?Job(?:&nbsp;|&#160;|\s|<[^>]+>)+Openings[\s\S]*?<\/h1>/i,
  )
  if (!headingMatch || headingMatch.index == null) return ''

  let sectionHtml = rawHtml.slice(headingMatch.index + headingMatch[0].length)
  const endPatterns = [
    /Based on(?:&nbsp;|&#160;|\s|<[^>]+>)+99(?:&nbsp;|&#160;|\s|<[^>]+>)+Reviews/i,
    /All Rights Reserved/i,
  ]

  let endIndex = sectionHtml.length
  for (const pattern of endPatterns) {
    const match = sectionHtml.match(pattern)
    if (match?.index != null) endIndex = Math.min(endIndex, match.index)
  }

  sectionHtml = sectionHtml.slice(0, endIndex)
  return sectionHtml
}

const deriveCity = (location) => {
  const normalized = String(location ?? '').trim()
  if (!normalized) return null
  if (normalized.includes(',')) return null
  if (/\bor\b/i.test(normalized) || normalized.includes('(')) return null
  return normalized
}

export const extractApplicationUrl = (html = '') =>
  normalizeWhitespace(
    String(html ?? '').match(/href=["'](mailto:careers@noccarc\.com[^"']*)["']/i)?.[1],
  ) || APPLICATION_URL

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers at Noccarc(?:\s*\|[\s\S]*?)?\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Careers at Noccarc')
    && normalized.includes('View Open Roles')
    && normalized.includes('Job Openings')
    && normalized.includes('Email Your CV')
    && /mailto:careers@noccarc\.com/i.test(rawHtml)
}

export const extractJobCards = (html = '') => {
  const sectionHtml = extractJobsSection(html)
  const cards = []
  const seen = new Set()

  for (const match of sectionHtml.matchAll(
    /<h1[^>]*>([\s\S]*?)<\/h1>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<p[^>]*>([\s\S]*?\byears\b[\s\S]*?)<\/p>/gi,
  )) {
    const title = stripHtml(match[1])
    const location = stripHtml(match[2])
    const experienceRequired = stripHtml(match[3])

    if (!title || !location || !experienceRequired) continue
    if (/^Job Openings$/i.test(title) || /^Based on\b/i.test(title)) continue
    if (!/\byears\b/i.test(experienceRequired)) continue

    const key = `${title}::${location}::${experienceRequired}`
    if (seen.has(key)) continue
    seen.add(key)

    cards.push({
      title,
      location,
      experienceRequired,
    })
  }

  return cards
}

const mapJob = (card, applyUrl, scrapedAt) => {
  const jobId = `${SOURCE}-${slugify(`${card.title}-${card.location}`)}`

  return {
    title: card.title,
    company: COMPANY,
    location: card.location,
    city: deriveCity(card.location),
    country: 'India',
    link: applyUrl,
    applyUrl,
    sourceUrl: CAREERS_URL,
    source: SOURCE,
    jobId,
    requisitionId: jobId,
    department: null,
    employmentType: null,
    experienceRequired: card.experienceRequired,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt,
  }
}

export const createNoccarcScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Noccarc official careers page changed materially')
    }

    const cards = extractJobCards(careersHtml)
    if (cards.length === 0) {
      throw new Error('Noccarc verified first-party job-card structure changed materially')
    }

    const cardsToMap = Number.isFinite(maxJobs) ? cards.slice(0, maxJobs) : cards
    const applyUrl = extractApplicationUrl(careersHtml)
    const scrapedAt = now()

    return cardsToMap.map((card) => mapJob(card, applyUrl, scrapedAt))
  },
})

export const run = async (options = {}) => createNoccarcScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
