import path from 'node:path'
import { fileURLToPath } from 'node:url'

import DTDC_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = DTDC_CATALOG.source
export const COMPANY = DTDC_CATALOG.companyName
export const ROOT_URL = DTDC_CATALOG.rootUrl
export const HOME_URL = DTDC_CATALOG.homepageUrl
export const CAREERS_URL = DTDC_CATALOG.companyCareerPage
export const ROBOTS_URL = DTDC_CATALOG.robotsTxtUrl
export const SITEMAP_INDEX_URL = DTDC_CATALOG.sitemapIndexUrl
export const PAGE_SITEMAP_URL = DTDC_CATALOG.pageSitemapUrl
export const MISSING_JOB_ROUTE_URLS = [
  'https://www.dtdc.com/jobs/',
  'https://www.dtdc.com/careers/',
  'https://www.dtdc.com/join-us/',
  'https://www.dtdc.com/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen roles\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /successfactors/i,
  /darwinbox/i,
  /jobvite/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
]

const stripHtmlComments = (value) => String(value ?? '').replace(/<!--[\s\S]*?-->/g, ' ')

const normalizeWhitespace = (value) => stripHtmlComments(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
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

export const hasPublicJobListingSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(stripHtmlComments(html)))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const normalizedLower = normalized.toLowerCase()
  const hasKnownTitle =
    /<title>\s*DTDC\s*\|\s*India[^<]*Trusted Courier Delivery & Logistics Company\s*<\/title>/i.test(rawHtml)
  const hasOfficialWebsiteBanner =
    normalizedLower.includes("www.dtdc.com is dtdc's only official website.")
  const hasCanonical =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.dtdc\.com\/in\/["']/i.test(rawHtml)
  const hasHero = /Leading Courier and Logistics Company in India/i.test(normalized)
  const hasCareerLink =
    /href=["'](?:https:\/\/www\.dtdc\.com)?\/career\/["']/i.test(rawHtml)

  return (hasKnownTitle || hasOfficialWebsiteBanner)
    && hasCanonical
    && hasHero
    && hasCareerLink
}

export const hasResumeDropCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Career and Jobs in Logistics and Courier Services \| DTDC\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.dtdc\.com\/career\/["']/i.test(rawHtml)
    && /Drive Your Career Forward in Logistics/i.test(normalized)
    && /mailto:careers@dtdc\.com/i.test(rawHtml)
    && /careers@dtdc\.com/i.test(normalized)
}

export const extractSitemapUrlFromRobots = (robotsTxt = '') =>
  String(robotsTxt ?? '').match(/^\s*Sitemap:\s*(\S+)/im)?.[1] || null

export const hasVerifiedSitemapIndexSignal = (xml = '') => {
  const text = String(xml ?? '')

  return /<sitemapindex\b/i.test(text)
    && /https:\/\/www\.dtdc\.com\/post-sitemap\.xml/i.test(text)
    && /https:\/\/www\.dtdc\.com\/page-sitemap\.xml/i.test(text)
    && /https:\/\/www\.dtdc\.com\/category-sitemap\.xml/i.test(text)
}

export const extractCareerLikeUrlsFromPageSitemap = (xml = '') => (
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => match[1]?.trim() || null)
    .filter((url) => url && /\/(career|careers|jobs|job|join-us|work-with-us|openings)\/?$/i.test(url))
)

export const isKnownMissingJobRoute = (page = {}, requestedUrl) =>
  Number(page?.status) === 404
  && getFinalUrl(page, requestedUrl) === requestedUrl
  && !hasPublicJobListingSignal(page?.html)

export const createDtdcScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(ROOT_URL)
    if (getFinalUrl(homepage, ROOT_URL) !== HOME_URL) {
      throw new Error('DTDC verified homepage redirect no longer matches the known public surface')
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('DTDC verified homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (getFinalUrl(careersPage, CAREERS_URL) !== CAREERS_URL) {
      throw new Error('DTDC verified careers route no longer matches the known public surface')
    }

    if (hasPublicJobListingSignal(careersPage.html)) {
      throw new Error('DTDC career page now appears to expose a public jobs board')
    }

    if (careersPage.status !== 200 || !hasResumeDropCareersSignal(careersPage.html)) {
      throw new Error('DTDC verified career page no longer matches the known public surface')
    }

    const robotsPage = await fetchPage(ROBOTS_URL)
    const sitemapUrl = extractSitemapUrlFromRobots(robotsPage.html)
    if (robotsPage.status !== 200 || sitemapUrl !== SITEMAP_INDEX_URL) {
      throw new Error('DTDC verified robots.txt no longer advertises the known sitemap contract')
    }

    const sitemapIndexPage = await fetchPage(SITEMAP_INDEX_URL)
    if (sitemapIndexPage.status !== 200 || !hasVerifiedSitemapIndexSignal(sitemapIndexPage.html)) {
      throw new Error('DTDC verified sitemap index no longer matches the known public surface')
    }

    const pageSitemapPage = await fetchPage(PAGE_SITEMAP_URL)
    const careerLikeUrls = extractCareerLikeUrlsFromPageSitemap(pageSitemapPage.html)
    if (
      pageSitemapPage.status !== 200
      || careerLikeUrls.length !== 1
      || careerLikeUrls[0] !== CAREERS_URL
    ) {
      throw new Error('DTDC verified page sitemap no longer matches the known no-public-careers surface')
    }

    for (const routeUrl of MISSING_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isKnownMissingJobRoute(routePage, routeUrl)) {
        throw new Error(`DTDC verified no-public-job route changed: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createDtdcScraper().run(options)

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
