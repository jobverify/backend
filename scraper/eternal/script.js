import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ETERNAL_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ETERNAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CANONICAL_CAREERS_URL = PROVIDER_METADATA.canonicalCareerUrl
export const CHECKED_NO_JOBS_ROUTE_URLS = [...PROVIDER_METADATA.checkedNoJobsRouteUrls]
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const NOT_FOUND_PAGE_TITLE = PROVIDER_METADATA.notFoundPageTitle

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bopen roles\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /darwinbox/i,
  /icims/i,
  /successfactors/i,
  /oraclecloud/i,
  /\bvacanc(?:y|ies)\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Eternal'
    && /href=["'](?:\/careers|https:\/\/www\.eternal\.com\/careers\/?)["']/i.test(rawHtml)
    && normalized.includes('Home')
    && normalized.includes('Culture')
    && normalized.includes('Careers')
    && normalized.includes('Investors')
    && normalized.includes('Impact')
    && normalized.includes('Contact')
}

export const hasVerifiedCareersShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Careers - Hiring at Eternal'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/eternal\.com\/careers["']/i.test(rawHtml)
    && /"@type"\s*:\s*"Organization"/i.test(rawHtml)
    && normalized.includes('Home Culture Careers Investors Impact Contact')
    && normalized.includes('Our businesses Zomato Blinkit District Hyperpure')
    && !hasPublicJobsSignal(rawHtml)
}

export const isVerifiedMissingJobRoute = (page = {}, requestedUrl) => {
  const normalized = normalizeWhitespace(page?.html)

  return Number(page?.status) === 200
    && sameUrl(page?.url || requestedUrl, requestedUrl)
    && extractTitle(page?.html) === NOT_FOUND_PAGE_TITLE
    && normalized.includes('Lost in the Eternal void?')
    && normalized.includes("We couldn't find the page you were looking for.")
    && !hasPublicJobsSignal(page?.html)
}

export const isVerifiedMissingDiscoveryRoute = (page = {}, requestedUrl) =>
  Number(page?.status) === 404
  && sameUrl(page?.url || requestedUrl, requestedUrl)
  && !hasPublicJobsSignal(page?.html)

export const createEternalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Eternal verified homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Eternal careers page now appears to expose a public jobs surface')
    }

    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasVerifiedCareersShellSignal(careersPage.html)
    ) {
      throw new Error('Eternal verified careers shell no longer matches the known public surface')
    }

    const robotsPage = await fetchPage(ROBOTS_TXT_URL)
    if (!isVerifiedMissingDiscoveryRoute(robotsPage, ROBOTS_TXT_URL)) {
      throw new Error('Eternal verified robots.txt changed')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (!isVerifiedMissingDiscoveryRoute(sitemapPage, SITEMAP_URL)) {
      throw new Error('Eternal verified sitemap.xml changed')
    }

    for (const routeUrl of CHECKED_NO_JOBS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingJobRoute(routePage, routeUrl)) {
        throw new Error(`Eternal verified no-jobs route changed: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEternalScraper().run(options)

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
