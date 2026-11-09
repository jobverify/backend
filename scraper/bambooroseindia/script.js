import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BAMBOO_ROSE_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BAMBOO_ROSE_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_PAGE_URL = PROVIDER_METADATA.careerPageUrl
export const LINKEDIN_JOBS_URL = PROVIDER_METADATA.linkedinJobsUrl
export const SITEMAP_INDEX_URL = PROVIDER_METADATA.sitemapIndexUrl
export const PAGE_SITEMAP_URL = PROVIDER_METADATA.pageSitemapUrl
export const CHECKED_MISSING_ROUTE_URLS = [...PROVIDER_METADATA.checkedMissingRouteUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_PAGE_TITLE = 'Careers - Bamboo Rose'
const HOMEPAGE_TITLE = 'Bamboo Rose | PLM & Supply Chain Technology'
const MISSING_ROUTE_TITLE = 'Page not found - Bamboo Rose'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'bamboorose.com' || hostname === 'www.bamboorose.com'
  } catch {
    return false
  }
}

const normalizeLinkedInJobsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, CAREER_PAGE_URL)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()

    if (hostname !== 'linkedin.com') return null

    if (/^\/company\/bamboorose\/jobs\/?$/i.test(url.pathname)) {
      return LINKEDIN_JOBS_URL
    }

    if (/^\/authwall\/?$/i.test(url.pathname)) {
      const redirected = url.searchParams.get('sessionRedirect')
      return redirected ? normalizeLinkedInJobsUrl(redirected) : null
    }
  } catch {
    return null
  }

  return null
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

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === HOMEPAGE_TITLE
    && normalized.includes('AI-Native TotalPLM')
    && normalized.includes('The Ultimate End-to-End Retail Supply Chain Platform')
    && normalized.includes('Trust Bamboo Rose')
    && normalized.includes('2026 Bamboo Rose, Inc. All Rights Reserved.')
}

export const extractLinkedInJobsUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const normalizedUrl = normalizeLinkedInJobsUrl(match[1])
    if (normalizedUrl) return normalizedUrl
  }

  return null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === CAREERS_PAGE_TITLE
    && normalized.includes('The Next Chapter of Your Career is Waiting')
    && normalized.includes('Join the Bamboo Rose team today.')
    && normalized.includes('Find Your Next Adventure')
    && normalized.includes('Manager, Application Development | India')
    && normalized.includes('View Current Openings')
}

export const hasFirstPartyPublicJobsSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  if (/"@type"\s*:\s*"JobPosting"/i.test(rawHtml) || /\bJobPosting\b/i.test(rawHtml)) {
    return true
  }

  for (const match of rawHtml.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREER_PAGE_URL)
    if (!absoluteUrl || !isOfficialDomainUrl(absoluteUrl)) continue

    try {
      const pathname = new URL(absoluteUrl).pathname.replace(/\/+$/, '/') || '/'
      if (/^\/(?:careers?|jobs?|join-us|openings)\/.+/i.test(pathname)) {
        return true
      }
    } catch {
      // Ignore malformed URLs and continue fail-closed through the other validators.
    }
  }

  return false
}

export const isMissingCareerRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && extractTitle(page.html) === MISSING_ROUTE_TITLE
  && !hasFirstPartyPublicJobsSignal(page.html)

export const hasPageSitemapSignal = (xml = '') =>
  /https?:\/\/bamboorose\.com\/page-sitemap\.xml/i.test(String(xml ?? ''))

export const extractCareerLikeUrlsFromPageSitemap = (xml = '') => (
  [...String(xml ?? '').matchAll(/https?:\/\/bamboorose\.com\/[^<\s]+/gi)]
    .map((match) => match[0].replace(/^http:\/\//i, 'https://'))
    .filter((url) => /https:\/\/bamboorose\.com\/(?:careers?|jobs?|join-us|openings)(?:\/|$)/i.test(url))
)

export const createBambooRoseIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (
      homepage.status !== 200
      || normalizeComparableUrl(homepage.url) !== normalizeComparableUrl(HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Bamboo Rose India verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREER_PAGE_URL)

    if (
      careersPage.status !== 200
      || normalizeComparableUrl(careersPage.url) !== normalizeComparableUrl(CAREER_PAGE_URL)
    ) {
      throw new Error('Bamboo Rose India verified careers page no longer matches the known first-party surface')
    }

    if (hasFirstPartyPublicJobsSignal(careersPage.html)) {
      throw new Error('Bamboo Rose India careers page now appears to expose a first-party public jobs surface')
    }

    if (!hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Bamboo Rose India verified careers page no longer matches the known first-party surface')
    }

    if (extractLinkedInJobsUrl(careersPage.html) !== LINKEDIN_JOBS_URL) {
      throw new Error('Bamboo Rose India verified LinkedIn handoff changed')
    }

    for (const routeUrl of CHECKED_MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Bamboo Rose India verified missing career route changed: ${routePage.url || routeUrl}`)
      }
    }

    const sitemapIndex = await fetchPage(SITEMAP_INDEX_URL)

    if (
      sitemapIndex.status !== 200
      || normalizeComparableUrl(sitemapIndex.url) !== normalizeComparableUrl(SITEMAP_INDEX_URL)
      || !hasPageSitemapSignal(sitemapIndex.html)
    ) {
      throw new Error('Bamboo Rose India verified sitemap index changed')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    const careerLikeUrls = extractCareerLikeUrlsFromPageSitemap(pageSitemap.html)

    if (
      pageSitemap.status !== 200
      || normalizeComparableUrl(pageSitemap.url) !== normalizeComparableUrl(PAGE_SITEMAP_URL)
      || careerLikeUrls.length !== 1
      || careerLikeUrls[0] !== CAREER_PAGE_URL
    ) {
      throw new Error('Bamboo Rose India verified page sitemap career surface changed')
    }

    return []
  },
})

export const run = async (options = {}) => createBambooRoseIndiaScraper().run(options)

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
