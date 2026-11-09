import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

import { INSIGHTSOFTWARE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_TENANT_HOST = PROVIDER_METADATA.workdayTenantHost
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialWorkdayBoardUrl
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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const buildScraperOptions = () => ({
  company: COMPANY,
  baseUrl: WORKDAY_BOARD_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: currentDir,
})

const makeAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const isIndiaLocation = (location) => /\bindia\b/i.test(location || '')

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const dashTokens = normalized
    .split(/\s+-\s+/)
    .map((token) => normalizeWhitespace(token))
    .filter(Boolean)

  if (dashTokens[0]?.toLowerCase() === 'india') {
    if (!dashTokens[1]) return 'India'
    if (/^remote$/i.test(dashTokens[1])) return 'Remote'
    return dashTokens[1]
  }

  const commaTokens = normalized
    .split(',')
    .map((token) => normalizeWhitespace(token))
    .filter(Boolean)

  if (commaTokens.at(-1)?.toLowerCase() === 'india') {
    return commaTokens[0]
  }

  return normalized
}

const inferRemoteStatus = (location) => (/\bremote\b/i.test(location || '') ? 'Remote' : null)

const extractJobId = (detailUrl) => {
  const normalized = String(detailUrl ?? '').replace(/\/+$/, '')
  const match = normalized.match(/([A-Z][-_]\d+)$/i)
  return match?.[1] || null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const hasLegacyInlineCards =
    text.includes('India - Bangalore')
    && text.includes('India - Hyderabad')
    && page.includes(WORKDAY_TENANT_HOST)
  const hasCurrentEmptyShell =
    text.includes('Showing 0 of 0')
    && text.includes('No job openings available at the moment.')

  return text.includes('Current Job Openings')
    && text.includes('Learn more about our high-energy, high-performance global team.')
    && (hasLegacyInlineCards || hasCurrentEmptyShell)
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /rel=["']canonical["'][^>]*href=["']https:\/\/magnitudesoftware\.wd1\.myworkdayjobs\.com\/External["']/i.test(page)
    && /property=["']og:title["'][^>]*content=["']Careers["']/i.test(page)
    && /cx-jobs\.min\.js/i.test(page)
    && /tenant:\s*"magnitudesoftware"/i.test(page)
    && /siteId:\s*"External"/i.test(page)
    && /insightsoftware/i.test(page)
}

const isTransientCareersAccessFailure = (value = {}) => {
  const status = Number(value?.status ?? value?.cause?.status)
  if ([403, 429, 500, 502, 503, 504].includes(status)) {
    return true
  }

  const text = `${value?.message || ''} ${value?.html || ''}`
  return /timed out|timeout|request could not be satisfied|gateway timeout/i.test(text)
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

  return lines.find((line) => /\bindia\b/i.test(line)) || null
}

const extractWorkdayCards = (html = '') => {
  const cards = []
  const page = String(html ?? '')
  const titleMatches = [...page.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]

  for (let index = 0; index < titleMatches.length; index += 1) {
    const match = titleMatches[index]
    const detailUrl = makeAbsoluteUrl(match[1], CAREERS_URL)
    const title = normalizeWhitespace(stripTags(match[2]))
    if (!detailUrl || !detailUrl.startsWith(WORKDAY_TENANT_HOST) || !title || /^view job$/i.test(title)) {
      continue
    }

    const nextIndex = titleMatches[index + 1]?.index ?? page.length
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

export const extractIndiaJobsFromCareersHtml = (
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

export const createInsightsoftwareScraper = ({
  now = () => new Date().toISOString(),
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    workdayRunner: workdayRunnerOverride = workdayRunner,
  } = {}) {
    let careersPage = null
    try {
      careersPage = await fetchPage(CAREERS_URL)
    } catch (error) {
      if (!isTransientCareersAccessFailure(error)) {
        throw error
      }
    }

    if (
      careersPage
      && !(
        careersPage.status === 200
        && careersPage.url === CAREERS_URL
        && hasOfficialCareersSignal(careersPage.html)
      )
    ) {
      if (!isTransientCareersAccessFailure(careersPage)) {
        throw new Error('The verified insightsoftware careers page no longer matches the trusted first-party surface')
      }
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoardPage, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (
      workdayBoardPage?.status !== 200
      || workdayBoardPage?.url !== WORKDAY_BOARD_URL
      || !hasOfficialWorkdayBoardSignal(workdayBoardPage.html)
    ) {
      throw new Error('The verified insightsoftware public Workday board no longer matches the trusted jobs surface')
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

export const run = async (options = {}) => createInsightsoftwareScraper(options).run(options)

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
