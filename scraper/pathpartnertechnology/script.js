import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PATHPARTNER_TECHNOLOGY_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_URL = PROVIDER_METADATA.companyCareerPage
export const PAGE_SITEMAP_URL = 'https://pathpartnertech.com/page-sitemap.xml'
export const CAREERS_URL = 'https://pathpartnertech.com/career/'
export const CAREERS_ALIAS_URL = 'https://pathpartnertech.com/careers/'
export const JOBS_URL = 'https://pathpartnertech.com/jobs/'

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

const normalizeWhitespace = (value = '') =>
  String(value ?? '')
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

const normalizePath = (pathname = '/') => (
  pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
)

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
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

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isTrustedUnavailableFailure = (error) => {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  const causeMessage = String(error?.cause?.message ?? '').toLowerCase()
  const combined = `${message} ${causeMessage}`

  return combined.includes('econnreset')
    || combined.includes('connection reset')
    || combined.includes('socket hang up')
    || combined.includes('timeout')
    || combined.includes('timed out')
}

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('PathPartner Technology is now a part of KPIT Group')
    && normalized.includes('Empowering Next-Generation Mobility Solutions')
    && normalized.includes('About Us')
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('About Us')
    && normalized.includes('PathPartner provides its clients the advantage of top-of-the-line technologies')
    && normalized.includes('OUR MISSION')
    && normalized.includes('Empowering the Future of Automotive Software')
    && normalized.includes('Our Journey So Far')
}

export const hasExpectedPageSitemapSurface = (xml = '') => {
  const page = String(xml ?? '')

  return /<loc>https:\/\/pathpartnertech\.com\/<\/loc>/i.test(page)
    && /<loc>https:\/\/pathpartnertech\.com\/about\/<\/loc>/i.test(page)
}

export const hasCareersLikeRoute = (xml = '') =>
  /https:\/\/pathpartnertech\.com\/[^<]*(careers?|jobs?|join-us|joinus|work-with-us|workwithus|openings)[^<]*/i
    .test(String(xml ?? ''))

export const isVerifiedMissingCareerRoute = (page = {}, expectedUrl = '') => {
  const html = String(page.html ?? page.text ?? '')

  return Number(page.status) === 404
    && matchesExpectedUrl(page.url || '', expectedUrl)
    && /Page not found - Pathpartnertech/i.test(html)
    && !pageExposesPublicJobListings(html)
}

const assertVerifiedCompanyPage = ({
  page,
  expectedUrl,
  routeLabel,
  signalMatcher,
}) => {
  if (
    Number(page.status) !== 200
    || !matchesExpectedUrl(page.url || '', expectedUrl)
    || !signalMatcher(page.html)
  ) {
    throw new Error(`PathPartner Technology verified ${routeLabel} no longer matches the official company surface`)
  }

  if (pageExposesPublicJobListings(page.html)) {
    throw new Error(`PathPartner Technology verified ${routeLabel} now appears to expose public jobs`)
  }
}

export const createPathPartnerTechnologyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      assertVerifiedCompanyPage({
        page: homepage,
        expectedUrl: HOMEPAGE_URL,
        routeLabel: 'homepage',
        signalMatcher: hasOfficialHomepageSignal,
      })

      const aboutPage = await fetchPage(ABOUT_URL)
      assertVerifiedCompanyPage({
        page: aboutPage,
        expectedUrl: ABOUT_URL,
        routeLabel: 'about page',
        signalMatcher: hasOfficialAboutPageSignal,
      })

      const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
      if (
        Number(pageSitemap.status) !== 200
        || !matchesExpectedUrl(pageSitemap.url || '', PAGE_SITEMAP_URL)
        || !hasExpectedPageSitemapSurface(pageSitemap.html)
      ) {
        throw new Error('PathPartner Technology verified page sitemap changed materially')
      }

      if (hasCareersLikeRoute(pageSitemap.html)) {
        throw new Error('PathPartner Technology sitemap now exposes a public careers-like route')
      }

      for (const routeUrl of [CAREERS_URL, CAREERS_ALIAS_URL, JOBS_URL]) {
        const routePage = await fetchPage(routeUrl)
        if (!isVerifiedMissingCareerRoute(routePage, routeUrl)) {
          throw new Error(`PathPartner Technology verified no-public-careers route changed: ${routePage.url || routeUrl}`)
        }
      }

      return []
    } catch (error) {
      if (isTrustedUnavailableFailure(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createPathPartnerTechnologyScraper().run(options)

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
