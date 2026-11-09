import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { MAGNITUDE_SOFTWARE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const REDIRECT_COMPANY_URL = PROVIDER_METADATA.redirectCompanyUrl
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

const makeAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const matchesOfficialInsightsoftwareUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    return actualUrl.hostname.replace(/^www\./i, '') === expectedUrl.hostname.replace(/^www\./i, '')
      && actualUrl.pathname === expectedUrl.pathname
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

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

export const extractCareersLinkUrl = (html = '', baseUrl = REDIRECT_COMPANY_URL) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Careers\s*<\/a>/gi)) {
    const absoluteUrl = makeAbsoluteUrl(match[1], baseUrl)
    if (matchesOfficialInsightsoftwareUrl(absoluteUrl, CAREERS_URL)) return CAREERS_URL
  }

  return null
}

export const hasRedirectedMagnitudePageSignal = (page = {}) => {
  const pageHtml = String(page?.html ?? '')
  const text = stripTags(pageHtml) || ''

  return page?.status === 200
    && matchesOfficialInsightsoftwareUrl(page?.url, REDIRECT_COMPANY_URL)
    && text.includes('Magnitude is now part of insightsoftware')
    && text.includes('Careers')
    && extractCareersLinkUrl(pageHtml, page?.url || REDIRECT_COMPANY_URL) === CAREERS_URL
}

const extractJobCards = (html = '') => {
  const cards = []

  for (const match of String(html ?? '').matchAll(/<article\b[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const articleHtml = match[1]
    const title = normalizeWhitespace(
      articleHtml.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
    )
    const href = normalizeWhitespace(articleHtml.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1])
    const detailUrl = makeAbsoluteUrl(href, CAREERS_URL)
    const location = normalizeWhitespace(
      articleHtml.match(/<span\b[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
    )
    const department = normalizeWhitespace(
      articleHtml.match(/<span\b[^>]*class=["'][^"']*job-department[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
    )

    if (!title || !detailUrl || !location || !detailUrl.startsWith(WORKDAY_TENANT_HOST)) continue

    cards.push({
      title,
      detailUrl,
      location,
      department,
    })
  }

  for (const match of String(html ?? '').matchAll(
    /(<div\b[^>]*class=["'][^"']*\bjob-item\b[^"']*["'][^>]*>)([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bjob-item\b|<\/section>|<\/main>|$)/gi,
  )) {
    const openingTag = match[1]
    const itemHtml = match[2]
    const title = normalizeWhitespace(
      openingTag.match(/\bdata-name=(["'])(.*?)\1/i)?.[2]
        || itemHtml.match(/<h3\b[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1],
    )
    const location = normalizeWhitespace(
      openingTag.match(/\bdata-location=(["'])(.*?)\1/i)?.[2]
        || itemHtml.match(/<span\b[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
    )
    const department = normalizeWhitespace(
      openingTag.match(/\bdata-department=(["'])(.*?)\1/i)?.[2],
    )
    const href = normalizeWhitespace(
      itemHtml.match(/<a\b[^>]*href=["'](https:\/\/magnitudesoftware\.wd1\.myworkdayjobs\.com\/[^"']+)["'][^>]*>/i)?.[1],
    )
    const detailUrl = makeAbsoluteUrl(href, CAREERS_URL)

    if (!title || !detailUrl || !location || !detailUrl.startsWith(WORKDAY_TENANT_HOST)) continue

    cards.push({
      title,
      detailUrl,
      location,
      department,
    })
  }

  return cards
}

const isIndiaLocation = (location) => /\bindia\b/i.test(location || '')

const deriveCity = (location) => {
  const tokens = String(location ?? '')
    .split(/\s+-\s+/)
    .map((token) => normalizeWhitespace(token))
    .filter(Boolean)

  if (tokens[0]?.toLowerCase() !== 'india') return null
  if (!tokens[1]) return 'India'
  if (/^remote$/i.test(tokens[1])) return 'Remote'
  return tokens[1]
}

const inferRemoteStatus = (location) => (/\bremote\b/i.test(location || '') ? 'Remote' : null)

const extractJobId = (detailUrl) => {
  const normalized = String(detailUrl ?? '').replace(/\/+$/, '')
  const match = normalized.match(/_([A-Za-z0-9-]+)$/)
  return match?.[1] || null
}

export const hasOfficialCareersSignal = (html = '') => {
  const pageHtml = String(html ?? '')
  const text = stripTags(pageHtml) || ''
  const hasLegacyInlineCards =
    text.includes('India - Bangalore')
    && text.includes('India - Hyderabad')
    && pageHtml.includes(WORKDAY_TENANT_HOST)
    && extractJobCards(pageHtml).length > 0
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

export const extractIndiaJobsFromCareersHtml = (
  html,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => extractJobCards(html)
  .filter((card) => isIndiaLocation(card.location))
  .map((card) => {
    const jobId = extractJobId(card.detailUrl)

    return {
      title: card.title,
      company: COMPANY,
      department: card.department,
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

export const createMagnitudeSoftwareScraper = ({
  now = () => new Date().toISOString(),
  workdayRunner = runWorkdayScraper,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    workdayRunner: workdayRunnerOverride = workdayRunner,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!hasRedirectedMagnitudePageSignal(homepage)) {
      throw new Error('Magnitude Software verified Magnitude homepage redirect no longer matches the trusted first-party surface')
    }

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
        && matchesOfficialInsightsoftwareUrl(careersPage.url, CAREERS_URL)
        && hasOfficialCareersSignal(careersPage.html)
      )
    ) {
      if (!isTransientCareersAccessFailure(careersPage)) {
        throw new Error('Magnitude Software verified first-party careers page no longer matches the trusted public jobs surface')
      }
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoardPage, { source: SOURCE, url: WORKDAY_BOARD_URL })
    if (
      workdayBoardPage?.status !== 200
      || workdayBoardPage?.url !== WORKDAY_BOARD_URL
      || !hasOfficialWorkdayBoardSignal(workdayBoardPage.html)
    ) {
      throw new Error('Magnitude Software verified public Workday board no longer matches the trusted jobs surface')
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

export const run = async (options = {}) => createMagnitudeSoftwareScraper(options).run(options)

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
