import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

import { ONIDA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ONIDA_CATALOG
export const SOURCE = ONIDA_CATALOG.source
export const COMPANY = ONIDA_CATALOG.companyName
export const VERIFIED_AT = ONIDA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ONIDA_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = ONIDA_CATALOG.officialHomepageUrl
export const LIFE_AT_ONIDA_URL = ONIDA_CATALOG.companyCareerPage
export const BLOCKED_CAREERS_ROUTE_URLS = [...ONIDA_CATALOG.blockedCareersRouteUrls]

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /icims/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null)

const normalizeTitleDashes = (value) => normalizeWhitespace(value)?.replace(/[–—]/g, '-') ?? null

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'onida.com' || hostname === 'www.onida.com'
  } catch {
    return false
  }
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractCurrentOpeningsHref = (html) =>
  String(html ?? '').match(/href=["']([^"']*)["'][^>]*>\s*Current Openings\s*</i)?.[1] ?? null

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /href=["']https:\/\/onida\.com\/life-at-onida["']/i.test(rawHtml)
    && normalizeWhitespace(extractCurrentOpeningsHref(rawHtml)) === ONIDA_CATALOG.currentOpeningsPlaceholderHref
    && normalized.includes('life@onida')
    && normalized.includes('current openings')
    && /onida/i.test(rawHtml)
    && !hasPublicJobBoardSignal(rawHtml)
}

export const hasOfficialLifeAtOnidaSignal = (html) => {
  const rawHtml = String(html ?? '')
  const descriptionMatches =
    /<meta[^>]+name=["']description["'][^>]+content=["']Explore life at Onida, our vibrant work culture, growth opportunities, and employee stories/i.test(rawHtml)
    || /<meta[^>]+content=["']Explore life at Onida, our vibrant work culture, growth opportunities, and employee stories[^"']*["'][^>]+name=["']description["']/i.test(rawHtml)

  return /href=["']https:\/\/onida\.com\/life-at-onida["']/i.test(rawHtml)
    && normalizeWhitespace(extractCurrentOpeningsHref(rawHtml)) === ONIDA_CATALOG.currentOpeningsPlaceholderHref
    && (descriptionMatches || normalizeText(rawHtml).includes('life@onida'))
    && /onida/i.test(rawHtml)
    && !hasPublicJobBoardSignal(rawHtml)
}

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeText(rawHtml)

  return Number(page.status) === 404
    && isOfficialDomainUrl(page.url || '')
    && /<title>\s*Onida\s*\|\s*404 Page Not Found\s*<\/title>/i.test(rawHtml)
    && normalized.includes('404')
    && normalized.includes('page not found')
    && !hasPublicJobBoardSignal(rawHtml)
}

export const createOnidaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Onida homepage no longer matches the verified first-party surface')
    }

    const lifeAtOnida = await fetchPage(LIFE_AT_ONIDA_URL)
    if (lifeAtOnida.status !== 200 || !hasOfficialLifeAtOnidaSignal(lifeAtOnida.html)) {
      throw new Error('Onida Life@Onida page no longer matches the verified placeholder openings surface')
    }

    for (const careersRouteUrl of BLOCKED_CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedMissingCareersRoute(careersRoute)) {
        throw new Error(`Onida careers route changed materially or now exposes a public jobs surface: ${careersRouteUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createOnidaScraper().run(options)

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
