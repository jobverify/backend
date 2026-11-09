import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ERUDITUS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ERUDITUS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_PAGE_URL = PROVIDER_METADATA.careerPageUrl
export const ABOUT_US_URL = PROVIDER_METADATA.aboutUsUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const SITEMAP_INDEX_URL = PROVIDER_METADATA.sitemapIndexUrl
export const PAGE_SITEMAP_URL = PROVIDER_METADATA.pageSitemapUrl
export const CHECKED_404_ROUTE_URLS = [...PROVIDER_METADATA.checked404RouteUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_LINK_PATTERNS = [
  /\/careers?(?:\/|$)/i,
  /\/jobs?(?:\/|$)/i,
  /\/join-us(?:\/|$)/i,
  /\/work-with-us(?:\/|$)/i,
  /\/openings?(?:\/|$)/i,
  /\/current-openings?(?:\/|$)/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /darwinbox/i,
  /peoplestrong/i,
  /successfactors/i,
  /oraclecloud/i,
  /linkedin\.com\/jobs/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;|’/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const extractLinks = (html = '') => (
  [...String(html ?? '').matchAll(/href=["']([^"'#]+)["']/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
)

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

export const hasPublicAtsOrCareersLink = (html = '') =>
  extractLinks(html).some((link) => CAREERS_LINK_PATTERNS.some((pattern) => pattern.test(link)))

export const hasHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Eruditus Executive Education'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/eruditus\.com\/?["']/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Eruditus Executive Education offers the best executive education programmes[\s\S]*?["']/i
      .test(rawHtml)
    && /about-us/i.test(rawHtml)
    && /newsroom/i.test(rawHtml)
    && normalized.includes("Learn. From the world's best.")
    && normalized.includes('Eruditus was founded in 2010')
    && !hasPublicAtsOrCareersLink(rawHtml)
}

export const robotsPublishSitemapIndex = (text = '') => (
  /Sitemap:\s*https:\/\/eruditus\.com\/sitemap_index\.xml/i.test(String(text ?? ''))
)

export const pageSitemapHasAboutUsRoute = (xml = '') => (
  /<loc>\s*https:\/\/eruditus\.com\/about-us\/\s*<\/loc>/i.test(String(xml ?? ''))
)

export const pageSitemapListsCareersRoute = (xml = '') => (
  /<loc>\s*https:\/\/eruditus\.com\/(?:careers?|jobs?|join-us|work-with-us|openings?|current-openings?)(?:\/)?\s*<\/loc>/i
    .test(String(xml ?? ''))
)

export const hasExpectedNotFoundSurface = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const status = Number(page?.status)

  const hasExpected404Page = status === 404
    && extractTitle(rawHtml) === 'Page not found - Eruditus Executive Education'
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,\s*follow["']/i.test(rawHtml)
    && /Eruditus\s+All\s+Rights\s+Reserved\./i.test(normalized)
    && rawHtml.includes('https://eruditus.com/about-us/')
    && rawHtml.includes('https://eruditus.com/newsroom/')
    && rawHtml.includes('https://eruditus.com/contact-us/')
    && !hasPublicAtsOrCareersLink(rawHtml)

  const hasExpected403BlockPage = status === 403
    && extractTitle(rawHtml) === '403 Forbidden'
    && /<h1>\s*403 Forbidden\s*<\/h1>/i.test(rawHtml)
    && /<center>\s*nginx\s*<\/center>/i.test(rawHtml)
    && !hasPublicAtsOrCareersLink(rawHtml)

  return hasExpected404Page || hasExpected403BlockPage
}

export const createEruditusScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (Number(homepage.status) !== 200 || !hasHomepageSignal(homepage.html)) {
      throw new Error('Eruditus verified homepage no longer matches the known first-party surface')
    }

    const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
    if (Number(robotsTxt.status) !== 200 || !robotsPublishSitemapIndex(robotsTxt.html)) {
      throw new Error('Eruditus verified robots.txt changed')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (
      Number(pageSitemap.status) !== 200
      || !pageSitemapHasAboutUsRoute(pageSitemap.html)
      || pageSitemapListsCareersRoute(pageSitemap.html)
    ) {
      throw new Error('Eruditus verified page sitemap changed')
    }

    for (const routeUrl of CHECKED_404_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!hasExpectedNotFoundSurface(routePage)) {
        throw new Error(`Eruditus verified 404 careers route changed: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEruditusScraper().run(options)

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
