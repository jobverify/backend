import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CAPITAL_NUMBERS_INFOTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CAPITAL_NUMBERS_INFOTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  return (
    /<title>Careers at Capital Numbers \| Explore Current Opportunities<\/title>/i.test(rawHtml)
    || normalized.includes('Build Your Career with Capital Numbers')
  )
    && normalized.includes('Capital Numbers')
    && (
      normalized.includes('Explore Current Opportunities')
      || normalized.includes('See Current Openings')
    )
    && (normalized.includes('jobs@capitalnumbers.com') || /mailto:jobs@capitalnumbers\.com/i.test(rawHtml))
  }

export const hasPublicJobListingSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /href=["'][^"']*(jobview|jobid=|openings?|current-openings?|applycareer)[^"']*["']/i.test(rawHtml)
    || /no\. of vacancies|location:\s|job description|view details/i.test(normalized)
}

export const extractJobs = (html = '') => [...String(html ?? '').matchAll(
  /<li class=["']rounded-\[10px\][^"']*["'][\s\S]*?<\/li>/gi,
)].map((match) => {
  const card = match[0]
  const title = normalizeWhitespace(card.match(/<p[^>]*text-base[^>]*>([\s\S]*?)<\/p>/i)?.[1])
  const location = normalizeWhitespace(card.match(/<dt[^>]*>\s*Location\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i)?.[1])
  const experienceRequired = normalizeWhitespace(card.match(/font-mono[^>]*>([\s\S]*?)<\/span>/i)?.[1])
  const href = card.match(/href=["'](\/careers\/[^"']+)["']/i)?.[1]
  const sourceUrl = href ? new URL(href, CAREERS_URL).toString() : null

  if (!title || !location || !sourceUrl) return null
  const jobId = href.split('/').filter(Boolean).at(-1)
  const indiaLocation = Boolean(CANONICAL_CITIES[location.toLowerCase()]) || /\bIndia\b/i.test(location)

  return {
    title,
    company: PROVIDER_METADATA.companyName,
    department: null,
    location: indiaLocation && !/\bIndia\b/i.test(location) ? `${location}, India` : location,
    city: location,
    country: indiaLocation ? 'India' : null,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  }
}).filter(Boolean)

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCapitalNumbersInfotechScraper = () => ({
  async run({ signal, fetchText = defaultFetchText } = {}) {
    const request = async (fetcher, url, options = {}) => {
      signal?.throwIfAborted()
      try { return await fetcher(url, { ...options, signal }) }
      finally { signal?.throwIfAborted() }
    }
    const careersHtml = await request(fetchText, CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Capital Numbers Infotech careers page no longer matches the verified first-party surface')
    }

    const jobs = extractJobs(careersHtml)
    const cardCount = [...String(careersHtml).matchAll(/<li class=["']rounded-\[10px\][^"']*["']/gi)].length
    const reportedCount = normalizeWhitespace(careersHtml).match(/\b(\d+)\s+open positions found\b/i)?.[1]
    if (jobs.length !== cardCount
      || new Set(jobs.map((job) => job.jobId)).size !== jobs.length
      || (reportedCount != null && Number(reportedCount) !== jobs.length)
      || (jobs.length === 0 && hasPublicJobListingSignal(careersHtml))) {
      throw new Error('Capital Numbers Infotech incomplete public job listing; refusing to publish a partial snapshot')
    }

    const scrapedAt = new Date().toISOString()
    return jobs.map((job) => ({ ...job, source: SOURCE, link: job.applyUrl, scrapedAt }))
  },
})

export const run = async (options = {}) => createCapitalNumbersInfotechScraper().run(options)

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
