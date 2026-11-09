import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import RAPID7_INDIA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = RAPID7_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const SEARCH_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
) || ''

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const firstMatch = (value, regex) => stripTags(String(value ?? '').match(regex)?.[1] || '')

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^hybrid$/i.test(normalized)) return 'Hybrid'
  if (/^remote$/i.test(normalized)) return 'Remote'
  if (/^in office$|^on[- ]site$/i.test(normalized)) return 'On-site'
  return normalized
}

const parseIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: 'India',
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts[parts.length - 1] || null

  return {
    location: normalized,
    city,
    country,
  }
}

export const buildSearchPageUrl = (pageNumber = 1) => {
  const normalizedPage = Number(pageNumber)
  return normalizedPage <= 1
    ? SEARCH_PAGE_URL
    : `${SEARCH_PAGE_URL}?page=${normalizedPage}`
}

export const hasOfficialRapid7SearchPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Search Page\s*<\/title>/i.test(page)
    && /Search All Roles/i.test(page)
    && /Rapid7 Chatbot/i.test(page)
    && /careers\.rapid7\.com\/jobs\//i.test(page)
}

export const extractJobCardsFromSearchPage = (html = '') => {
  const matches = String(html ?? '').matchAll(
    /<tr[^>]+role=["']link["'][^>]+data-job-url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/tr>/gi,
  )
  const cards = []

  for (const match of matches) {
    const sourceUrl = normalizeWhitespace(match[1])
    const rowHtml = match[2]
    const title = firstMatch(
      rowHtml,
      /class=["']job-search-results-title["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
    )
    const requisitionId = normalizeWhitespace(
      rowHtml.match(/aria-label=["']Requisition Identifier:\s*([^"']+)["']/i)?.[1]
      || rowHtml.match(/class=["']job-search-results-requisition-identifiers["'][^>]*>([\s\S]*?)<\/td>/i)?.[1],
    )
    const department = normalizeWhitespace(
      rowHtml.match(/aria-label=["']Department:\s*([^"']+)["']/i)?.[1]
      || rowHtml.match(/class=["']job-search-results-department["'][\s\S]*?<li[^>]*>([\s\S]*?)<\/li>/i)?.[1],
    )
    const location = normalizeWhitespace(
      rowHtml.match(/aria-label=["']Location:\s*([^"']+)["']/i)?.[1]
      || rowHtml.match(/class=["']job-search-results-location["'][\s\S]*?<li[^>]*>([\s\S]*?)<\/li>/i)?.[1],
    )
    const workplaceType = firstMatch(
      rowHtml,
      /class=["']job-search-results-workplace-types["'][^>]*>([\s\S]*?)<\/td>/i,
    )

    if (!sourceUrl || !title || !requisitionId || !department || !location) continue

    cards.push({
      title,
      requisitionId,
      department,
      location,
      workplaceType: workplaceType || null,
      sourceUrl,
      applyUrl: sourceUrl,
    })
  }

  return cards
}

export const extractIndiaJobsFromCards = (cards = [], scrapedAt) =>
  cards
    .filter((card) => /\bIndia\b/i.test(card.location || ''))
    .map((card) => {
      const locationBits = parseIndiaLocation(card.location)

      return {
        title: card.title,
        company: COMPANY_NAME,
        department: card.department,
        location: locationBits.location,
        city: locationBits.city,
        country: locationBits.country,
        jobId: card.requisitionId,
        requisitionId: card.requisitionId,
        sourceUrl: card.sourceUrl,
        applyUrl: card.applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: normalizeRemoteStatus(card.workplaceType),
        source: SOURCE,
        link: card.applyUrl,
        scrapedAt,
      }
    })

export const createRapid7IndiaScraper = ({
  now = () => new Date().toISOString(),
  maxPages = 1,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const scrapedAt = now()
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const pageHtml = await fetchText(buildSearchPageUrl(page))

      if (page === 1 && !hasOfficialRapid7SearchPageSignal(pageHtml)) {
        throw new Error('Rapid7 India verified Rapid7 search page changed materially')
      }

      const pageCards = extractJobCardsFromSearchPage(pageHtml)
      if (pageCards.length === 0) {
        break
      }

      for (const job of extractIndiaJobsFromCards(pageCards, scrapedAt)) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createRapid7IndiaScraper(options).run(options)

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
