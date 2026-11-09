import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { enrichJobsWithPublicExperience } from '../../scraper-support/utils/publicExperienceEnrichment.js'

import RUPEEK_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = RUPEEK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const OFFICIAL_CAREERS_CANONICAL_URL = PROVIDER_METADATA.officialCareersCanonicalUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const FOREIGN_LOCATION_PATTERN =
  /\b(singapore|uae|united arab emirates|dubai|united states|usa|canada|united kingdom|uk|germany|france|poland|ireland|australia|netherlands|malaysia|indonesia|japan|vietnam)\b/i

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextValue = decoded
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
      .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')

    if (nextValue === decoded) break
    decoded = nextValue
  }

  return decoded
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractParagraphTexts = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean)

const extractLinkedInJobId = (url) =>
  normalizeWhitespace(url)?.match(/-(\d+)(?:[/?#]|$)/)?.[1] || null

const parseCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/greater bengaluru area/i.test(normalized)) return 'Bengaluru'

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  return parts[0] || null
}

const isIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return false
  if (FOREIGN_LOCATION_PATTERN.test(normalized)) return false
  return true
}

export const hasOfficialRupeekCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page)
  const text = normalizeWhitespace(page) || ''
  const hasLegacyContentSignals = /Why join Us/i.test(text)
    && /Engineering at Rupeek/i.test(text)
    && /Open Positions/i.test(text)
  const hasCurrentValueSignals = text.includes('Excellent Growth')
    && text.includes('Wealth creation')
    && text.includes('Work that matters')
    && text.includes('Passionate, Energetic People')
    && text.includes('Innovation')

  return title === 'Join our team | Rupeek | Careers'
    && new RegExp(`href=["']${OFFICIAL_CAREERS_CANONICAL_URL}["']`, 'i').test(page)
    && (hasLegacyContentSignals || hasCurrentValueSignals)
    && /https:\/\/www\.linkedin\.com\/jobs\/view\//i.test(page)
}

export const extractJobCardsFromCareersHtml = (html = '') => {
  const seenJobIds = new Set()
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href=["'](https:\/\/www\.linkedin\.com\/jobs\/view\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const sourceUrl = normalizeWhitespace(match[1])
    const cardHtml = match[2]
    const texts = extractParagraphTexts(cardHtml)
    const title = texts[0] || null
    const locationText = texts.find((text) => /^location:/i.test(text))
    const postingDate = texts.at(-1) || null
    const location = normalizeWhitespace(locationText?.replace(/^location:\s*/i, ''))
    const jobId = extractLinkedInJobId(sourceUrl)

    if (!title || !location || !jobId || !sourceUrl || seenJobIds.has(jobId)) continue
    if (!isIndiaLocation(location)) continue

    seenJobIds.add(jobId)
    jobs.push({
      title,
      location,
      city: parseCity(location),
      country: 'India',
      jobId,
      requisitionId: null,
      sourceUrl,
      applyUrl: sourceUrl,
      postingDate,
    })
  }

  return jobs
}

export const createRupeekScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialRupeekCareersSignals(careersHtml)) {
      throw new Error('Rupeek verified official careers page no longer matches the verified public surface')
    }

    const jobs = extractJobCardsFromCareersHtml(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Rupeek verified careers page did not expose any public India job cards')
    }

    const limitedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const baseJobs = limitedJobs.map((job) => ({
      title: job.title,
      company: COMPANY_NAME,
      department: null,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: job.postingDate,
      closingDate: null,
      jobDescription: null,
      source: SOURCE,
      link: job.applyUrl,
    }))
    const enrichedJobs = await enrichJobsWithPublicExperience(baseJobs, {
      fetchText,
      useBrowserFallback: false,
      concurrency: Math.min(4, Math.max(1, baseJobs.length)),
    })

    return enrichedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createRupeekScraper(options).run(options)

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
