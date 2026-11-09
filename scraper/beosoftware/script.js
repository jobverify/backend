import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import BEO_SOFTWARE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BEO_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractFirst = (pattern, value) => {
  const match = String(value ?? '').match(pattern)
  return match ? match[1] : null
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const toIsoDate = (value) => {
  const match = String(value ?? '').match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
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
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Discover Jobs/i.test(rawHtml)
    && normalized.includes('Discover Jobs')
    && (
      /Location\s*:|Posted on/i.test(normalized)
      || hasVerifiedSubscriptionShell(rawHtml)
    )
}

export const hasVerifiedSubscriptionShell = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Discover Jobs/i.test(rawHtml)
    && normalized.includes('Join our community')
    && normalized.includes('Be the first one to get alerts when we post new job opportunities')
    && /subscription-form/i.test(rawHtml)
}

export const extractJobCards = (html = '') => Array.from(
  String(html ?? '').matchAll(/<(article|li)\b[^>]*>([\s\S]*?)<\/\1>/gi),
  (match) => {
    const block = match[2]
    const title = normalizeWhitespace(
      extractFirst(/<h2[^>]*>([\s\S]*?)<\/h2>/i, block)
        || extractFirst(/<p[^>]*class=["'][^"']*\bsearch-headding\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i, block),
    )
    const location = normalizeWhitespace(extractFirst(/<p>\s*Location\s*:\s*([^<]+)<\/p>/i, block))
    const postedOn = normalizeWhitespace(extractFirst(/<p>\s*Posted on\s*([^<]+)<\/p>/i, block))
    const detailUrl = toAbsoluteUrl(extractFirst(/<a[^>]+href=["']([^"']+)["']/i, block))

    return {
      title,
      location: location ? `${location}, India` : null,
      city: location,
      postingDate: toIsoDate(postedOn),
      detailUrl,
    }
  },
).filter((job) => job.title && job.detailUrl)

export const createBeoSoftwareScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Verified BEO Software careers page no longer matches the trusted first-party surface')
    }

    const cards = extractJobCards(careersHtml)
    if (cards.length === 0) {
      if (hasVerifiedSubscriptionShell(careersHtml)) {
        return []
      }

      throw new Error('BEO Software official careers page exposes no structured public job cards')
    }

    return cards.map((card) => ({
      title: card.title,
      company: COMPANY,
      department: null,
      location: card.location,
      city: card.city,
      country: 'India',
      jobId: slugify(card.title),
      requisitionId: slugify(card.title),
      sourceUrl: card.detailUrl,
      applyUrl: card.detailUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: card.postingDate,
      closingDate: null,
      jobDescription: null,
      source: SOURCE,
      link: card.detailUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createBeoSoftwareScraper().run(options)

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
