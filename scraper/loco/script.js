import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LOCO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = LOCO_CATALOG.source
export const COMPANY = LOCO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = LOCO_CATALOG.officialBrandName
export const VERIFIED_ON = LOCO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = LOCO_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = LOCO_CATALOG
export const HOMEPAGE_URL = LOCO_CATALOG.homepageUrl
export const LEGACY_HOMEPAGE_URL = LOCO_CATALOG.legacyHomepageUrl
export const TERMS_OF_USE_URL = LOCO_CATALOG.termsOfUseUrl
export const NO_PUBLIC_CAREER_ROUTE_URLS = [
  'https://loco.com/about',
  'https://loco.com/company',
  'https://loco.com/careers',
  'https://loco.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bopen jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview all open positions\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /icims/i,
  /taleo/i,
]

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
  } catch {
    return false
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Loco:\s*(?:Go all in on live streaming|Free Online Gaming, Esports Tournaments &amp; Live Streaming)\s*<\/title>/i.test(page)
    && /Loco:\s*(?:Go all in on live streaming|Free Online Gaming, Esports Tournaments (?:&|&amp;) Live Streaming)/i.test(normalized)
    && /static\.loco\.gg\/next-assets/i.test(page)
  }

export const hasTermsOfUseSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Loco\s*\|\s*Terms Of Use\s*<\/title>/i.test(page)
    && normalized.includes('TERMS OF USE')
    && normalized.includes('Last updated: 19 June, 2026')
    && normalized.includes('Loco Streaming Ltd')
    && normalized.includes('publishing_legal@loco.gg')
  }

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}, expectedUrl = '') => {
  const html = String(page.html ?? page.text ?? '')

  return Number(page.status) === 404
    && matchesExpectedUrl(page.url || '', expectedUrl)
    && !pageExposesPublicJobListings(html)
}

export const createLocoScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage.status) !== 200
      || !matchesExpectedUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('The verified exact-name homepage for Loco no longer matches the first-party surface')
    }

    if (pageExposesPublicJobListings(homepage.html)) {
      throw new Error('The exact-name Loco homepage now appears to expose a first-party public jobs surface')
    }

    const legacyHomepage = await fetchPage(LEGACY_HOMEPAGE_URL)
    if (
      Number(legacyHomepage.status) !== 200
      || !matchesExpectedUrl(legacyHomepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(legacyHomepage.html)
    ) {
      throw new Error('The verified Loco legacy homepage redirect no longer matches the exact-name live surface')
    }

    const termsPage = await fetchPage(TERMS_OF_USE_URL)
    if (
      Number(termsPage.status) !== 200
      || !matchesExpectedUrl(termsPage.url, TERMS_OF_USE_URL)
      || !hasTermsOfUseSignal(termsPage.html)
    ) {
      throw new Error('The verified Loco legal company surface no longer matches the exact-name terms page')
    }

    if (pageExposesPublicJobListings(termsPage.html)) {
      throw new Error('The Loco legal company surface now appears to expose public jobs')
    }

    for (const routeUrl of NO_PUBLIC_CAREER_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage, routeUrl)) {
        throw new Error(`Loco verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLocoScraper().run(options)

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
