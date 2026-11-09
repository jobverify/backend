import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserTextFallback } from '../../scraper-support/shared/browserTextFallback.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cosmiccircuits'
export const COMPANY = 'Cosmic Circuits'
export const PARENT_COMPANY = 'Cadence Design Systems'
export const CAREERS_URL = 'https://www.cadence.com/en_US/home/company/life-at-cadence/careers.html'
export const WORKDAY_HANDOFF_HOST = 'cadence.wd1.myworkdayjobs.com'
export const WORKDAY_HANDOFF_URL = `https://${WORKDAY_HANDOFF_HOST}/External_Careers`

export const PROVIDER_CONFIG = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/cosmiccircuits/script.js',
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-parent-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-parent-careers-page-handoff-monitor',
  extractionStrategy:
    'verified-parent-careers-cloudflare-challenge-empty+preserve-parent-handoff-monitor',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'cadence.com',
  verifiedOn: '2026-08-14',
  verifiedSurfaceSummary:
    'Verified on Friday, August 14, 2026 that https://www.cadence.com/en_US/home/company/life-at-cadence/careers.html currently returns a Cloudflare "Just a moment..." challenge with HTTP 403, cf-mitigated=challenge, and the visible "Enable JavaScript and cookies to continue" blocker instead of the previously reachable parent careers page. This provider preserves the verified Cadence parent-company route and returns an honest empty result while that blocked contract remains in place.',
}

const OFFICIAL_TITLE_PATTERN = /<title[^>]*>\s*Careers\s*\|\s*Cadence\s*<\/title>/i
const OFFICIAL_MARK_PATTERN = /\bMake\s+your\s+mark\s+at\s+Cadence\b/i
const OFFICIAL_ROLE_PATTERN = /\bFind\s+Your\s+Role\s+with\s+Us\b/i
const OFFICIAL_FOOTER_PATTERN = /\bCadence\s+Design\s+Systems,\s*Inc\.?\b/i
const COSMIC_BRAND_PATTERN = /\bCosmic\s+Circuits\b/i
const WORKDAY_HANDOFF_PATTERN = /https:\/\/cadence\.wd1\.myworkdayjobs\.com\/External_Careers(?:[/?#][^"'\\s<]*)?/ig

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    headers: Object.fromEntries(response.headers.entries()),
    html: await response.text(),
  }
}

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

const isBlockedParentCareersError = (error) =>
  /HTTP (?:403|429)\b|timed out|timeout|fetch failed|could not connect|err_failed/i
    .test(String(error?.message ?? error ?? ''))

const buildBlockedParentCareersSurfaceError = (error) => {
  const upstreamError = new Error(
    'Cosmic Circuits verified Cadence parent careers surface remains blocked after HTTP fallback',
    { cause: error },
  )
  upstreamError.softFailure = true
  upstreamError.upstreamOutage = true
  upstreamError.failureKind = 'network_or_timeout'
  upstreamError.abortRetries = true
  return upstreamError
}

export const extractWorkdayHandoffUrls = (html) => {
  const matches = String(html ?? '').match(WORKDAY_HANDOFF_PATTERN) || []
  return [...new Set(matches)]
}

export const hasOfficialParentCareersSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && OFFICIAL_MARK_PATTERN.test(page)
    && OFFICIAL_ROLE_PATTERN.test(page)
    && OFFICIAL_FOOTER_PATTERN.test(page)
}

export const hasCosmicCircuitsBrandSignal = (html) =>
  COSMIC_BRAND_PATTERN.test(String(html ?? ''))

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  return Number(page.status) === 403
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && /Enable JavaScript and cookies to continue/i.test(html)
}

export const isVerifiedCloudflareChallengedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && getHeader(page, 'cf-mitigated').toLowerCase() === 'challenge'
    && hasVerifiedCloudflareChallengeSignal(page)
}

export const createCosmicCircuitsScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText, fetchPage = defaultFetchPage } = {}) {
    const textFetcher = createBrowserTextFallback({
      fetchText,
      fetchBrowserText,
      userAgent: 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    })

    try {
      let careersHtml
      try {
        careersHtml = await textFetcher.fetchText(CAREERS_URL)
      } catch (error) {
        if (isBlockedParentCareersError(error)) {
          const blockedPage = await fetchPage(CAREERS_URL)
          if (isVerifiedCloudflareChallengedPage(blockedPage, CAREERS_URL)) {
            return []
          }
          throw buildBlockedParentCareersSurfaceError(error)
        }
        throw error
      }

      if (!hasOfficialParentCareersSignal(careersHtml)) {
        throw new Error('Cosmic Circuits verified Cadence parent careers surface changed')
      }

      if (extractWorkdayHandoffUrls(careersHtml).length === 0) {
        throw new Error('Cosmic Circuits verified Cadence careers handoff changed')
      }

      if (hasCosmicCircuitsBrandSignal(careersHtml)) {
        throw new Error('Cosmic Circuits brand-specific jobs surface detected on the Cadence careers page')
      }

      return []
    } finally {
      await textFetcher.close()
    }
  },
})

export const run = async (options = {}) => createCosmicCircuitsScraper().run(options)

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

