import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { IG_INFOTECH_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CONTACT_PAGE_URL = PROVIDER_METADATA.companyContactPageUrl
export const WORKDAY_LISTING_URL = PROVIDER_METADATA.workdayListingUrl
export const WORKDAY_TENANT_HOST = PROVIDER_METADATA.workdayTenantHost
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const INDIA_LOCATION_COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/main|\/li|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|main|li|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const makeAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const inferRemoteStatus = (location) => (/\bremote\b/i.test(location || '') ? 'Remote' : null)

const extractJobId = (detailUrl) => {
  const normalized = String(detailUrl ?? '').replace(/\/+$/, '')
  const match = normalized.match(/([A-Z][-_]\d+)$/i)
  return match?.[1] || null
}

const isIndiaLocation = (location) => /\bindia\b/i.test(location || '')

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const commaTokens = normalized
    .split(',')
    .map((token) => normalizeWhitespace(token))
    .filter(Boolean)
  if (commaTokens.at(-1)?.toLowerCase() === 'india') {
    return commaTokens[0]
  }

  const dashTokens = normalized
    .split(/\s+-\s+/)
    .map((token) => normalizeWhitespace(token))
    .filter(Boolean)
  if (dashTokens[0]?.toLowerCase() === 'india') {
    return dashTokens[1] || 'India'
  }

  return normalized
}

export const buildScraperOptions = () => ({
  company: COMPANY,
  baseUrl: WORKDAY_LISTING_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: currentDir,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return text.includes('We’re a fintech with scale, legacy and proof.')
    && text.includes('Find a role you love')
    && page.includes(WORKDAY_LISTING_URL)
}

export const hasOfficialBengaluruEntitySignal = (html = '') => {
  const text = stripTags(html) || ''

  return text.includes('Bengaluru')
    && text.includes('IG Infotech India Private Limited')
    && text.includes('Domlur, Bengaluru 560071')
    && text.includes('+91 80 6818 8000')
}

export const hasOfficialWorkdayListingSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const hasLegacyListingCards = text.includes('Head Of Workforce Management')
    && text.includes('Content Producer')
    && text.includes('Web & SEO Copywriter')
    && text.includes('Bangalore, India')
  const hasLiveWorkdayShell =
    /rel=["']canonical["'][^>]*href=["']https:\/\/ig\.wd103\.myworkdayjobs\.com\/EXT_IG["']/i.test(page)
    && /cx-jobs\.min\.js/i.test(page)
    && /tenant:\s*"ig"/i.test(page)
    && /siteId:\s*"EXT_IG"/i.test(page)
    && /IG Group can provide that/i.test(page)

  return page.includes(WORKDAY_TENANT_HOST)
    && (hasLegacyListingCards || hasLiveWorkdayShell)
}

const extractLocationFromSegment = (segment) => {
  const explicitLocation = normalizeWhitespace(
    segment.match(/<span\b[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
  )
  if (explicitLocation) return explicitLocation

  const lines = (stripTags(segment) || '')
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .filter((line) => !/^view job$/i.test(line))

  return lines.find((line) => /(?:\bindia\b|\buk\b|\busa\b|\blondon\b)/i.test(line)) || null
}

const extractWorkdayCards = (html = '') => {
  const page = String(html ?? '')
  const cards = []
  const matches = [...page.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const detailUrl = makeAbsoluteUrl(match[1], WORKDAY_LISTING_URL)
    const title = normalizeWhitespace(stripTags(match[2]))
    if (!detailUrl || !detailUrl.startsWith(WORKDAY_TENANT_HOST) || !title || /^view job$/i.test(title)) {
      continue
    }

    const nextIndex = matches[index + 1]?.index ?? page.length
    const segment = page.slice(match.index, nextIndex)
    const location = extractLocationFromSegment(segment)
    if (!location) continue

    const key = `${detailUrl}::${title}`
    if (cards.some((card) => `${card.detailUrl}::${card.title}` === key)) continue

    cards.push({
      title,
      detailUrl,
      location,
    })
  }

  return cards
}

export const extractIndiaJobsFromWorkdayHtml = (
  html,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => extractWorkdayCards(html)
  .filter((card) => isIndiaLocation(card.location))
  .map((card) => {
    const jobId = extractJobId(card.detailUrl)

    return {
      title: card.title,
      company: COMPANY,
      department: null,
      location: card.location,
      city: deriveCity(card.location),
      country: 'India',
      sourceUrl: card.detailUrl,
      applyUrl: `${card.detailUrl}/apply`,
      jobId,
      requisitionId: jobId,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: inferRemoteStatus(card.location),
      source: SOURCE,
      link: card.detailUrl,
      scrapedAt,
    }
  })

export const createIgInfotechIndiaScraper = ({
  now = () => new Date().toISOString(),
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    workdayRunner: workdayRunnerOverride = workdayRunner,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified IG careers page no longer matches the trusted first-party surface')
    }

    const contactHtml = await fetchText(CONTACT_PAGE_URL)
    if (!hasOfficialBengaluruEntitySignal(contactHtml)) {
      throw new Error('The verified IG Bengaluru entity page no longer matches the trusted first-party surface')
    }

    const listingHtml = await fetchText(WORKDAY_LISTING_URL)
    assertWorkdayPageAvailable({ status: 200, html: listingHtml, url: WORKDAY_LISTING_URL }, { source: SOURCE, url: WORKDAY_LISTING_URL })
    if (!hasOfficialWorkdayListingSignal(listingHtml)) {
      throw new Error('The verified IG Workday listing page no longer matches the trusted first-party surface')
    }

    const jobs = await workdayRunnerOverride(buildScraperOptions())

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      scrapedAt: job.scrapedAt || now(),
    }))
  },
})

export const run = async (options = {}) => createIgInfotechIndiaScraper(options).run(options)

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
