import path from 'node:path'
import { fileURLToPath } from 'node:url'

import EAZY_DINER_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EAZY_DINER_CATALOG.source
export const COMPANY = EAZY_DINER_CATALOG.companyName
export const ROOT_URL = EAZY_DINER_CATALOG.rootUrl
export const CAREERS_URL = EAZY_DINER_CATALOG.companyCareerPage
export const ROBOTS_URL = EAZY_DINER_CATALOG.robotsTxtUrl
export const SITEMAP_URL = EAZY_DINER_CATALOG.sitemapUrl
export const OTHER_ROUTES_SITEMAP_URL = EAZY_DINER_CATALOG.otherRoutesSitemapUrl
export const MISSING_JOB_ROUTE_URLS = [
  'https://www.eazydiner.com/careers',
  'https://www.eazydiner.com/jobs',
  'https://www.eazydiner.com/join-us',
  'https://www.eazydiner.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen roles\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
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

const normalizeWhitespace = (value) => String(value ?? '')
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

export const hasPublicJobListingSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Find the Best Restaurants with Great Deals \| Eazydiner\s*<\/title>/i.test(rawHtml)
    && /href=["']https:\/\/www\.eazydiner\.com\/career["']/i.test(rawHtml)
    && /contact us/i.test(normalized)
    && /blogs/i.test(normalized)
}

export const hasResumeDropCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Explore Career Opportunities at EazyDiner \| Apply Now\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.eazydiner\.com\/career["']/i.test(rawHtml)
    && /want to join the dining ride\?/i.test(normalized)
    && /mailto:career@eazydiner\.com/i.test(rawHtml)
    && /career@eazydiner\.com/i.test(normalized)
}

export const extractSitemapUrlFromRobots = (robotsTxt = '') =>
  String(robotsTxt ?? '').match(/^\s*Sitemap:\s*(\S+)/im)?.[1] || null

export const hasVerifiedSitemapIndexSignal = (xml = '') => {
  const text = String(xml ?? '')

  return /<sitemapindex\b/i.test(text)
    && /https:\/\/www\.eazydiner\.com\/sitemap\/index-locations\.xml/i.test(text)
    && /https:\/\/www\.eazydiner\.com\/sitemap\/others\.xml/i.test(text)
    && /https:\/\/www\.eazydiner\.com\/sitemap\/city-delhi-ncr\.xml/i.test(text)
}

export const isMissingSitemapPlaceholder = (page = {}) =>
  Number(page?.status) === 404
  && String(page?.url || '') === SITEMAP_URL
  && /Sitemap not found/i.test(String(page?.html ?? ''))
  && !hasPublicJobListingSignal(page?.html)

export const extractCareerLikeUrlsFromSitemap = (xml = '') => (
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => match[1]?.trim() || null)
    .filter((url) => url && /\/(career|careers|jobs|job|join-us|work-with-us|openings)\/?$/i.test(url))
)

export const isKnownMissingJobRoute = (page = {}, requestedUrl) =>
  Number(page?.status) === 404
  && (page?.url || requestedUrl) === requestedUrl
  && !hasPublicJobListingSignal(page?.html)

export const createEazyDinerScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(ROOT_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('EazyDiner verified homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || careersPage.url !== CAREERS_URL) {
      throw new Error('EazyDiner verified careers route no longer matches the known public surface')
    }

    if (hasPublicJobListingSignal(careersPage.html)) {
      throw new Error('EazyDiner career page now appears to expose a public jobs board')
    }

    if (!hasResumeDropCareersSignal(careersPage.html)) {
      throw new Error('EazyDiner verified career page no longer matches the known public surface')
    }

    const robotsPage = await fetchPage(ROBOTS_URL)
    const sitemapUrl = extractSitemapUrlFromRobots(robotsPage.html)
    if (robotsPage.status !== 200 || sitemapUrl !== SITEMAP_URL) {
      throw new Error('EazyDiner verified robots.txt no longer advertises the known sitemap contract')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (
      !(
        (sitemapPage.status === 200 && hasVerifiedSitemapIndexSignal(sitemapPage.html))
        || isMissingSitemapPlaceholder(sitemapPage)
      )
    ) {
      throw new Error('EazyDiner verified sitemap index no longer matches the known public surface')
    }

    const othersSitemapPage = await fetchPage(OTHER_ROUTES_SITEMAP_URL)
    const careerLikeUrls = extractCareerLikeUrlsFromSitemap(othersSitemapPage.html)
    if (
      othersSitemapPage.status !== 200
      || careerLikeUrls.length !== 1
      || careerLikeUrls[0] !== CAREERS_URL
    ) {
      throw new Error('EazyDiner verified other-routes sitemap no longer matches the known no-public-careers surface')
    }

    for (const routeUrl of MISSING_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isKnownMissingJobRoute(routePage, routeUrl)) {
        throw new Error(`EazyDiner verified no-public-job route changed: ${routePage?.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEazyDinerScraper().run(options)

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
