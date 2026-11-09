import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const LEGACY_CAREERS_URL = PROVIDER_METADATA.legacyCareersUrl
export const LEGACY_CAREERS_FORM_URL = PROVIDER_METADATA.legacyApplicationFormUrl
export const SITEMAP_URL = 'https://www.ptechnosoft.com/sitemap.xml'
export const CAREERS_ROUTE_URL = 'https://ptechnosoft.com/careers'
export const CAREER_ROUTE_URL = 'https://ptechnosoft.com/career'
export const JOBS_ROUTE_URL = 'https://ptechnosoft.com/jobs'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bopen positions?\b/i,
  /\bcurrent openings\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bopen jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview all open positions\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /darwinbox/i,
  /ashbyhq\.com/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#8217;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const normalizePath = (pathname = '/') => (pathname === '/' ? '/' : pathname.replace(/\/+$/, ''))

const normalizeHostname = (hostname = '') => String(hostname ?? '')
  .replace(/^www\./i, '')
  .toLowerCase()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    return normalizeHostname(actualUrl.hostname) === normalizeHostname(expectedUrl.hostname)
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
    text: await response.text(),
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Autonomous Resilience Platform | Perpetuuiti')
    && normalized.includes('Autonomous resilience for the AI era.')
    && normalized.includes('Built on 15 years of enterprise resilience expertise.')
    && normalized.includes('Book a Resilience Assessment')
}

export const hasExpectedSitemapSurface = (xml = '') => {
  const page = String(xml ?? '')

  return /<loc>https:\/\/ptechnosoft\.com\/<\/loc>/i.test(page)
    && /<loc>https:\/\/ptechnosoft\.com\/about\/<\/loc>/i.test(page)
    && /<loc>https:\/\/ptechnosoft\.com\/contact\/<\/loc>/i.test(page)
}

export const hasCareersLikeRoute = (xml = '') =>
  /https:\/\/ptechnosoft\.com\/[^<]*(careers?|jobs?|join-us|joinus|work-with-us|workwithus|openings)[^<]*/i
    .test(String(xml ?? ''))

export const isHomepageRedirectSurface = (page = {}, expectedUrl = HOMEPAGE_URL) =>
  Number(page.status) === 200
  && matchesExpectedUrl(page.url || '', expectedUrl)
  && hasOfficialHomepageSignal(page.text)
  && !pageExposesPublicJobListings(page.text)

export const isExpectedMissingCareerRoute = (page = {}, expectedUrl = '') =>
  Number(page.status) === 404
  && matchesExpectedUrl(page.url || '', expectedUrl)
  && /404 Not Found/i.test(String(page.text ?? ''))
  && !pageExposesPublicJobListings(page.text)

export const createPerpetuuitiTechnosoftServicesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!isHomepageRedirectSurface(homepage, HOMEPAGE_URL)) {
      throw new Error('The verified Perpetuuiti homepage changed materially')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (
      Number(sitemapPage.status) !== 200
      || !matchesExpectedUrl(sitemapPage.url || '', SITEMAP_URL)
      || !hasExpectedSitemapSurface(sitemapPage.text)
    ) {
      throw new Error('The verified Perpetuuiti sitemap changed materially')
    }

    if (hasCareersLikeRoute(sitemapPage.text)) {
      throw new Error('The verified Perpetuuiti sitemap now exposes a careers-like route')
    }

    for (const routeUrl of [LEGACY_CAREERS_URL, LEGACY_CAREERS_FORM_URL]) {
      const routePage = await fetchPage(routeUrl)
      if (!isHomepageRedirectSurface(routePage, HOMEPAGE_URL)) {
        throw new Error(`The verified Perpetuuiti legacy careers redirect changed materially: ${routeUrl}`)
      }
    }

    for (const routeUrl of [CAREERS_ROUTE_URL, CAREER_ROUTE_URL, JOBS_ROUTE_URL]) {
      const routePage = await fetchPage(routeUrl)
      if (!isExpectedMissingCareerRoute(routePage, routeUrl)) {
        throw new Error(`The verified Perpetuuiti no-public-careers route changed materially: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPerpetuuitiTechnosoftServicesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
