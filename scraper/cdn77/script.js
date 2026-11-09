import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CDN77_CATALOG } from './catalog.js'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)

export const PROVIDER_METADATA = CDN77_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const REQUEST_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
}

const HTML_ENTITY_MAP = {
  '&amp;': '&',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#x27;': "'",
  '&#8217;': "'",
}

const decodeHtml = (value) => {
  let decoded = String(value ?? '')

  for (const [entity, replacement] of Object.entries(HTML_ENTITY_MAP)) {
    decoded = decoded.replaceAll(entity, replacement)
  }

  return decoded
}

const clean = (value) => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripBrandEmoji = (value) => clean(value).replace(/^[^\p{L}\p{N}]+/u, '').trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: REQUEST_HEADERS,
  label: SOURCE,
  timeoutMs: 20000,
})

export const buildAbsoluteUrl = (value) => new URL(value, CAREERS_URL).toString()

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = clean(page)

  return /<title>\s*Práce v CDN77\.com \| CDN77\.jobs\s*<\/title>/i.test(page)
    && /\(c\)\s*2026\s*DataCamp Limited/i.test(page)
    && normalized.includes('Pracovní nabídky')
    && normalized.includes('Koho zrovna hledáme')
    && normalized.includes('Všechny nabídky')
}

export const extractVisibleJobCount = (html = '') => {
  const match = String(html ?? '').match(
    /<span[^>]*>\s*Všechny nabídky\s*<\/span>\s*<span[^>]*>\s*(\d+)\s*<\/span>/i,
  )
  return match ? Number.parseInt(match[1], 10) : null
}

const JOB_CARD_PATTERN =
  /<a href="(\/nabidka\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<span class="text-sm">([\s\S]*?)<\/span>[\s\S]*?<span class="text-sm">([\s\S]*?)<\/span>/gi

const extractJobId = (href) => String(href ?? '').match(/\/nabidka\/(\d+)-/i)?.[1] || null

export const extractListingCardsFromCareersHtml = (html = '') => {
  const cards = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(JOB_CARD_PATTERN)) {
    const href = clean(match[1])
    const department = clean(match[2]) || null
    const title = stripBrandEmoji(match[3]) || null
    const location = clean(match[4]) || null
    const employmentType = clean(match[5]) || null
    const sourceUrl = href ? buildAbsoluteUrl(href) : null
    const jobId = extractJobId(href)

    if (!href || !title || !location || !employmentType || !sourceUrl || !jobId) {
      throw new Error('[cdn77] CDN77 jobs page exposes a malformed listing card')
    }

    if (seen.has(sourceUrl)) continue
    seen.add(sourceUrl)

    cards.push({
      href,
      jobId,
      title,
      location,
      employmentType,
      department,
      sourceUrl,
    })
  }

  return cards
}

const isIndiaLocation = (value) => /\bindia\b/i.test(clean(value))

const inferCity = (value) => {
  const normalized = clean(value)
  if (!normalized) return null
  if (/^remote\b/i.test(normalized)) return 'Remote'

  const firstToken = normalized.split(',')[0]?.trim() || null
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return firstToken
}

export const mapIndiaCardsToJobs = (cards, { scrapedAt = new Date().toISOString() } = {}) =>
  cards.flatMap((card) => {
    if (!isIndiaLocation(card.location)) return []

    return [{
      title: card.title,
      company: COMPANY_NAME,
      location: card.location,
      city: inferCity(card.location),
      country: 'India',
      link: card.sourceUrl,
      applyUrl: card.sourceUrl,
      sourceUrl: card.sourceUrl,
      source: SOURCE,
      jobId: card.jobId,
      requisitionId: card.jobId,
      department: card.department,
      employmentType: card.employmentType,
      experienceRequired: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      scrapedAt,
    }]
  })

export const createCdn77Scraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('[cdn77] CDN77 verified first-party jobs page no longer matches the trusted surface')
    }

    const visibleJobCount = extractVisibleJobCount(careersHtml)
    const cards = extractListingCardsFromCareersHtml(careersHtml)

    if (visibleJobCount == null) {
      throw new Error('[cdn77] CDN77 visible job count contract drifted from the verified page')
    }

    if (cards.length === 0) {
      if (visibleJobCount === 0) {
        return []
      }

      throw new Error('[cdn77] CDN77 jobs page no longer exposes recognizable listing cards')
    }

    if (cards.length !== visibleJobCount) {
      throw new Error(
        `[cdn77] CDN77 visible job count contract drifted: parsed ${cards.length} cards for visible count ${visibleJobCount}`,
      )
    }

    return mapIndiaCardsToJobs(cards, { scrapedAt: now() })
  },
})

export const run = (options = {}) => createCdn77Scraper().run(options)

const isDirectRun = () => {
  if (!process.argv[1]) return false
  return path.resolve(process.argv[1]) === currentFilePath
}

if (isDirectRun()) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
