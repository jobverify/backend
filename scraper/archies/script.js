import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ARCHIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ARCHIES_CATALOG.source
export const COMPANY = ARCHIES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ARCHIES_CATALOG.officialBrandName
export const VERIFIED_ON = ARCHIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ARCHIES_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ARCHIES_CATALOG
export const HOMEPAGE_URL = ARCHIES_CATALOG.companyCareerPage
export const CAREERS_ROUTE_URLS = [
  'https://archiesonline.com/careers',
  'https://archiesonline.com/career',
  'https://archiesonline.com/jobs',
  'https://archiesonline.com/join-us',
  'https://archiesonline.com/work-with-us',
  'https://archiesonline.com/openings',
]
export const CRAWL_SURFACE_URLS = [
  'https://archiesonline.com/robots.txt',
  'https://archiesonline.com/sitemap.xml',
  'https://archiesonline.com/sitemap_pages_1.xml?from=693794865301&to=710639354005',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
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
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#8211;|&ndash;|\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripScriptAndStyle = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'archiesonline.com' || hostname === 'www.archiesonline.com'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?archiesonline\.com)?\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasCareerRouteInSitemap = (content) =>
  /https?:\/\/(?:www\.)?archiesonline\.com\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|<|\?|#|$)/i.test(
    String(content ?? ''),
  )

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<link\s+rel=["']canonical["']\s+href=["']https:\/\/archiesonline\.com\/["']/i.test(rawHtml)
    && normalized.includes('Buy Gifts, Greeting Cards, Cakes & Flowers Online | Archies - Archies Online')
    && /Shop online for personalized gifts, greeting cards, cakes, and fresh flowers at Archies\. Make every celebration special with Archies Online\./i.test(
      rawHtml,
    )
    && normalized.includes('helpdesk@archiesonline.com')
    && /https:\/\/www\.linkedin\.com\/company\/archies-limited\//i.test(rawHtml)
}

export const hasOfficialRobotsTxtSignal = (content) => {
  const text = String(content ?? '')

  return /# Shopify storefront\. Public product, collection, page, blog, policy, cart, and localized HTML is crawlable\./i.test(
    text,
  )
    && /User-agent:\s*\*/i.test(text)
    && /Sitemap:\s*https:\/\/archiesonline\.com\/sitemap\.xml/i.test(text)
    && !hasCareerRouteInSitemap(text)
}

export const hasOfficialSitemapSignal = (content) => {
  const text = String(content ?? '')

  return /<sitemapindex/i.test(text)
    && /https:\/\/archiesonline\.com\/sitemap_agentic_discovery\.xml/i.test(text)
    && /https:\/\/archiesonline\.com\/sitemap_pages_1\.xml\?from=693794865301(?:&amp;|&)to=710639354005/i.test(
      text,
    )
}

export const hasOfficialPageSitemapSignal = (content) => {
  const text = String(content ?? '')

  return /<urlset/i.test(text)
    && /https:\/\/archiesonline\.com\/pages\/contact<\/loc>/i.test(text)
    && /https:\/\/archiesonline\.com\/pages\/about<\/loc>/i.test(text)
    && /https:\/\/archiesonline\.com\/pages\/store-locator<\/loc>/i.test(text)
    && /https:\/\/archiesonline\.com\/pages\/track-orders<\/loc>/i.test(text)
}

export const isMissingCareerRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page.status) === 404
    && isOfficialDomainUrl(page.url || HOMEPAGE_URL)
    && /<title>\s*(?:404 Not Found (?:&#8211;|&ndash;|\u2013|-)\s*Archies Online|404 Not Found)\s*<\/title>/i.test(rawHtml)
    && /<link\s+rel=["']canonical["']\s+href=["']https:\/\/archiesonline\.com\/404["']/i.test(rawHtml)
    && /"pageType"\s*:\s*"404"/i.test(rawHtml)
    && normalized.includes('helpdesk@archiesonline.com')
    && !hasPublicJobsSignal(rawHtml)
    && !hasFirstPartyCareerLikeLink(rawHtml)
}

export const createArchiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Archies verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Archies homepage now appears to expose public jobs')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Archies homepage now exposes a first-party careers or jobs link')
    }

    const robotsTxt = await fetchPage(CRAWL_SURFACE_URLS[0])
    if (robotsTxt.status !== 200 || !hasOfficialRobotsTxtSignal(robotsTxt.html)) {
      throw new Error('Archies verified robots.txt surface no longer matches the known public surface')
    }
    if (hasCareerRouteInSitemap(robotsTxt.html)) {
      throw new Error('Archies robots.txt now advertises a careers or jobs route')
    }

    const sitemap = await fetchPage(CRAWL_SURFACE_URLS[1])
    if (sitemap.status !== 200 || !hasOfficialSitemapSignal(sitemap.html)) {
      throw new Error('Archies verified sitemap surface no longer matches the known public surface')
    }
    if (hasCareerRouteInSitemap(sitemap.html)) {
      throw new Error('Archies sitemap now advertises a careers or jobs route')
    }

    const pageSitemap = await fetchPage(CRAWL_SURFACE_URLS[2])
    if (pageSitemap.status !== 200 || !hasOfficialPageSitemapSignal(pageSitemap.html)) {
      throw new Error('Archies verified page sitemap surface no longer matches the known public surface')
    }
    if (hasCareerRouteInSitemap(pageSitemap.html)) {
      throw new Error('Archies page sitemap now advertises a careers or jobs route')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Archies verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createArchiesScraper().run(options)

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
