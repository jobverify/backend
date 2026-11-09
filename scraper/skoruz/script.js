import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SKORUZ_CATALOG from './catalog.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SKORUZ_CATALOG.source
export const COMPANY = SKORUZ_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SKORUZ_CATALOG.officialBrandName
export const VERIFIED_ON = SKORUZ_CATALOG.verifiedOn
export const PROVIDER_METADATA = SKORUZ_CATALOG
export const CAREERS_URL = SKORUZ_CATALOG.companyCareerPage
export const INDIA_IFRAME_URL = SKORUZ_CATALOG.embeddedIndiaJobsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNITED_STATES_EMPTY_STATE =
  'currently, no openings available. please check back later for updates. thank you for your interest!'
const MONTH_INDEX_BY_NAME = new Map([
  ['january', 0],
  ['february', 1],
  ['march', 2],
  ['april', 3],
  ['may', 4],
  ['june', 5],
  ['july', 6],
  ['august', 7],
  ['september', 8],
  ['october', 9],
  ['november', 10],
  ['december', 11],
])

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

const slugify = (value) =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const calendarMatch = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/)

  if (calendarMatch) {
    const monthIndex = MONTH_INDEX_BY_NAME.get(calendarMatch[1].toLowerCase())
    const day = Number.parseInt(calendarMatch[2], 10)
    const year = Number.parseInt(calendarMatch[3], 10)

    if (monthIndex !== undefined && Number.isInteger(day) && Number.isInteger(year)) {
      return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10)
    }
  }

  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null
}

const extractLocationParts = (description) => {
  const rawLocation = normalizeWhitespace(
    String(description ?? '').match(/\bJobs based in\s+([^.!?]+?)(?:[.!?]|$)/i)?.[1] ?? '',
  )
  const parts = rawLocation.match(/^([^,]+),\s*([A-Z]{2})$/)

  if (!parts) {
    return {
      location: rawLocation || 'United States',
      city: null,
      state: null,
      country: 'United States',
    }
  }

  const city = normalizeWhitespace(parts[1])
  const state = normalizeWhitespace(parts[2])

  return {
    location: `${city}, ${state}, United States`,
    city,
    state,
    country: 'United States',
  }
}

export const extractIndiaIframeUrl = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] ?? null)
    || null

export const hasUnitedStatesEmptyState = (html) =>
  normalizeWhitespace(html).toLowerCase().includes(UNITED_STATES_EMPTY_STATE)

export const extractPublicUsJobs = (html) => {
  const jobs = []
  const jobBlockPattern = /<h4\b[^>]*>[\s\S]*?<p[^>]*>\s*<strong>\s*Date Posted:\s*([^<]+?)\s*<\/strong>\s*<\/p>\s*<p[^>]*>\s*<strong>\s*([^:<]+?)\s*:\s*<\/strong>\s*([\s\S]*?)<\/p>[\s\S]*?<\/h4>/gi
  let match

  while ((match = jobBlockPattern.exec(String(html ?? '')))) {
    const postedAt = toIsoDate(match[1])
    const title = normalizeWhitespace(match[2])
    const description = normalizeWhitespace(match[3])
    const location = extractLocationParts(description)
    const applyEmail = normalizeWhitespace(
      description.match(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i)?.[1] ?? '',
    )
    const jobIdParts = [title, postedAt, location.country]
      .filter(Boolean)
      .map((value) => slugify(value))
      .filter(Boolean)

    if (!title || !description) {
      continue
    }

    jobs.push({
      title,
      company: COMPANY,
      description,
      postedAt,
      postingDate: postedAt,
      location: location.location,
      city: location.city,
      state: location.state,
      country: location.country,
      source: SOURCE,
      sourceUrl: CAREERS_URL,
      applyUrl: applyEmail ? `mailto:${applyEmail.toLowerCase()}` : CAREERS_URL,
      companyCareerPage: CAREERS_URL,
      companyDomain: SKORUZ_CATALOG.companyDomain,
      atsPlatform: SKORUZ_CATALOG.atsPlatform,
      jobId: jobIdParts.join('-') || null,
    })
  }

  return jobs
}

export const hasVerifiedCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const iframeUrl = extractIndiaIframeUrl(html)
  const hasPublicUsJobs = extractPublicUsJobs(html).length > 0

  return normalized.includes('careers | skoruz technologies pvt ltd')
    && normalized.includes('join us')
    && normalized.includes('multiple open positions')
    && normalized.includes('india')
    && normalized.includes('united states')
    && iframeUrl === INDIA_IFRAME_URL
    && (hasUnitedStatesEmptyState(html) || hasPublicUsJobs)
}

export const isTrustedIndiaIframeFailure = (error) => {
  const message = normalizeWhitespace(error?.message ?? error).toLowerCase()

  return message.includes('trust relationship')
    || message.includes('ssl/tls')
    || message.includes('secure channel')
    || message.includes('could not connect')
    || message.includes('connect timeout error')
    || message.includes('timeout:')
    || message.includes('timeout error')
    || message.includes('timed out')
    || message.includes('certificate')
}

export class SkoruzIndiaInventoryUnavailableError extends Error {
  constructor(cause, { otherRegionJobCount = 0 } = {}) {
    super(`Skoruz India inventory unavailable: ${normalizeWhitespace(cause?.message ?? cause)}`, { cause })
    this.name = 'SkoruzIndiaInventoryUnavailableError'
    this.softFailure = true
    this.upstreamOutage = true
    this.abortRetries = true
    this.failureKind = 'network_or_timeout'
    this.inventoryScope = 'India'
    this.otherRegionJobCount = otherRegionJobCount
  }
}

const buildIndiaDiscoveryOnlyEvidence = (now, { otherRegionJobCount = 0 } = {}) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: INDIA_IFRAME_URL,
    firstParty: false,
    listingComplete: false,
    pagesFetched: 1,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: now(),
    reason: `Skoruz India iframe is currently unavailable; ${otherRegionJobCount} visible non-India jobs were not published as India inventory.`,
  })

export const createSkoruzScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified Skoruz careers page')
    }

    const iframeUrl = extractIndiaIframeUrl(careersHtml)
    if (!iframeUrl) {
      throw new Error('The verified Skoruz careers page no longer exposes the India iframe URL')
    }

    const publicUsJobs = extractPublicUsJobs(careersHtml)

    try {
      await fetchText(iframeUrl)
    } catch (error) {
      if (isTrustedIndiaIframeFailure(error)) {
        return buildIndiaDiscoveryOnlyEvidence(now, {
          otherRegionJobCount: publicUsJobs.length,
        })
      }

      throw error
    }

    throw new Error('Skoruz India jobs iframe became reachable or changed materially')
  },
})

export const run = async (options = {}) => createSkoruzScraper(options).run(options)

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
