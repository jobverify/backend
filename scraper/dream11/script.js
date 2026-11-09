import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DREAM11_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DREAM11_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const PARENT_COMPANY_NAME = PROVIDER_METADATA.parentCompanyName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const PARENT_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PARENT_CAREERS_LANDING_URL = PROVIDER_METADATA.parentCareersLandingUrl
export const LINKED_CAREERS_URL = PROVIDER_METADATA.linkedCareersUrl
export const DREAM11_REDIRECT_ROUTE_URLS = [
  'https://www.dream11.com/careers',
  'https://www.dream11.com/careers/',
  'https://www.dream11.com/jobs',
  'https://www.dream11.com/join-us',
]
export const DREAM11_MISSING_ROUTE_URLS = [
  'https://www.dream11.com/about-us/careers',
]
export const PARENT_MISSING_ROUTE_URLS = [
  'https://www.dreamsports.group/jobs',
  'https://www.dreamsports.group/openings',
  'https://www.dreamsports.group/careers/jobs',
  'https://www.dreamsports.group/careers/openings',
  'https://www.dreamsports.group/lifeatdreamsports/jobs',
  'https://www.dreamsports.group/lifeatdreamsports/openings',
  'https://www.dreamsports.group/lifeatdreamsports/careers',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /\bapply now\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bcurrent openings\b/i,
]

const PUBLIC_BOARD_URL_PATTERNS = [
  /\bjobs\.lever\.co\b/i,
  /\bboards\.greenhouse\.io\b/i,
  /\bmyworkdayjobs\b/i,
  /\bsmartrecruiters\b/i,
  /\bashbyhq\b/i,
]

const normalizeWhitespace = (value = '') => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const hasPublicJobSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizeWhitespace(html)))
  || [...String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .some((match) => PUBLIC_BOARD_URL_PATTERNS.some((pattern) => pattern.test(match[1])))

export const extractParentCareersUrlFromHomepage = (html = '') => {
  const match = /href=["'](https:\/\/www\.dreamsports\.group\/careers\/?)["']/i.exec(String(html ?? ''))
  return match?.[1] ?? null
}

export const hasHomepageCareersEntrySignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const linkedCareersUrl = extractParentCareersUrlFromHomepage(rawHtml)

  return linkedCareersUrl === LINKED_CAREERS_URL
    || /role=["']link["'][^>]*>[\s\S]{0,200}?\bCareers\b[\s\S]{0,200}?<\/(?:div|button)>/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /India's Biggest Fantasy Sports Platform: Play for Free\. Win Big\./i.test(normalized)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.dream11\.com\/["']/i.test(rawHtml)
    && /\bSporta Technologies Private Limited\b/i.test(normalized)
    && hasHomepageCareersEntrySignal(rawHtml)
}

export const isVerifiedDream11RedirectedNoTrustRoute = (page = {}, requestedUrl) =>
  Number(page?.status) === 200
  && getFinalUrl(page, requestedUrl) === HOMEPAGE_URL
  && hasOfficialHomepageSignal(page.html)

export const isVerifiedMissingRoute = (page = {}, requestedUrl) =>
  Number(page?.status) === 404
  && getFinalUrl(page, requestedUrl) === requestedUrl
  && !hasPublicJobSignal(page.html)

export const hasParentCareersLandingSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /\bDreamSports\b/i.test(rawHtml)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.dreamsports\.group\/careers["']/i.test(rawHtml)
    && /\bLIFE AT DREAM SPORTS\b/i.test(normalized)
    && /Game On\.\s*Build Big\./i.test(normalized)
    && /\bSporta Technologies Pvt Ltd\b/i.test(normalized)
    && !PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const createDream11Scraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Dream11 verified official Dream11 homepage no longer matches the known public surface')
    }

    for (const routeUrl of DREAM11_REDIRECT_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedDream11RedirectedNoTrustRoute(routePage, routeUrl)) {
        throw new Error(`Dream11 verified Dream11 no-trust route changed: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    for (const routeUrl of DREAM11_MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage, routeUrl)) {
        throw new Error(`Dream11 verified Dream11 no-trust route changed: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    const parentCareersPage = await fetchPage(PARENT_CAREERS_URL)
    if (
      parentCareersPage.status !== 200
      || getFinalUrl(parentCareersPage, PARENT_CAREERS_URL) !== PARENT_CAREERS_LANDING_URL
      || !hasParentCareersLandingSignal(parentCareersPage.html)
    ) {
      throw new Error('Dream11 verified Dream Sports careers landing page no longer matches the known public surface or now exposes public jobs')
    }

    for (const routeUrl of PARENT_MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage, routeUrl)) {
        throw new Error(`Dream11 verified Dream11 or Dream Sports alternate job route changed: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createDream11Scraper().run(options)

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
