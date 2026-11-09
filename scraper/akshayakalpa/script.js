import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AKSHAYAKALPA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AKSHAYAKALPA_CATALOG.source
export const COMPANY = AKSHAYAKALPA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AKSHAYAKALPA_CATALOG.officialBrandName
export const VERIFIED_ON = AKSHAYAKALPA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AKSHAYAKALPA_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AKSHAYAKALPA_CATALOG
export const HOMEPAGE_URL = AKSHAYAKALPA_CATALOG.companyCareerPage
export const CAREERS_ROUTE_URLS = [
  'https://akshayakalpa.org/careers',
  'https://akshayakalpa.org/careers/',
  'https://akshayakalpa.org/career',
  'https://akshayakalpa.org/jobs',
  'https://akshayakalpa.org/join-us',
  'https://akshayakalpa.org/work-with-us',
  'https://akshayakalpa.org/openings',
]
export const CRAWL_SURFACE_URLS = [
  'https://akshayakalpa.org/robots.txt',
  'https://akshayakalpa.org/sitemap.xml',
  'https://akshayakalpa.org/page-sitemap.xml',
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

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

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

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'akshayakalpa.org' || hostname === 'www.akshayakalpa.org'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?akshayakalpa\.org)?\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasCareerRouteInSitemap = (content) =>
  /https?:\/\/(?:www\.)?akshayakalpa\.org\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|<|\?|#|$)/i.test(String(content ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Pure,\s*untouched,\s*organic milk from cows raised with care\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Trusted by 180,000 families for over 16 years')
    && normalized.includes('farmer entrepreneurship initiatives')
    && normalized.includes('support@akshayakalpa.org')
}

export const hasOfficialRobotsTxtSignal = (content) => {
  const text = String(content ?? '')

  return /User-agent:\s*\*/i.test(text)
    && /Crawl-Delay:\s*20/i.test(text)
    && !hasCareerRouteInSitemap(text)
}

export const hasOfficialSitemapSignal = (content) => {
  const text = String(content ?? '')

  return /<sitemapindex/i.test(text)
    && /https:\/\/akshayakalpa\.org\/post-sitemap\.xml/i.test(text)
    && /https:\/\/akshayakalpa\.org\/page-sitemap\.xml/i.test(text)
    && /https:\/\/akshayakalpa\.org\/testimonials-sitemap\.xml/i.test(text)
}

export const hasOfficialPageSitemapSignal = (content) => {
  const text = String(content ?? '')

  return /<urlset/i.test(text)
    && /https:\/\/akshayakalpa\.org\/<\/loc>/i.test(text)
    && /https:\/\/akshayakalpa\.org\/products\/<\/loc>/i.test(text)
    && /https:\/\/akshayakalpa\.org\/resources\/<\/loc>/i.test(text)
    && /https:\/\/akshayakalpa\.org\/about-us\/<\/loc>/i.test(text)
}

export const isMissingCareerRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page.status) === 404
    && isOfficialDomainUrl(page.url || '')
    && /<title>\s*Page not found - Akshayakalpa Organic Milk\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Page not found')
    && normalized.includes('support@akshayakalpa.org')
    && !hasPublicJobsSignal(rawHtml)
    && !hasFirstPartyCareerLikeLink(rawHtml)
}

export const createAkshayakalpaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Akshayakalpa verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Akshayakalpa homepage now appears to expose public jobs')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Akshayakalpa homepage now exposes a first-party careers or jobs link')
    }

    const robotsTxt = await fetchPage(CRAWL_SURFACE_URLS[0])
    if (robotsTxt.status !== 200 || !hasOfficialRobotsTxtSignal(robotsTxt.html)) {
      throw new Error('Akshayakalpa verified robots.txt surface no longer matches the known public surface')
    }
    if (hasCareerRouteInSitemap(robotsTxt.html)) {
      throw new Error('Akshayakalpa robots.txt now advertises a careers or jobs route')
    }

    const sitemap = await fetchPage(CRAWL_SURFACE_URLS[1])
    if (sitemap.status !== 200 || !hasOfficialSitemapSignal(sitemap.html)) {
      throw new Error('Akshayakalpa verified sitemap surface no longer matches the known public surface')
    }
    if (hasCareerRouteInSitemap(sitemap.html)) {
      throw new Error('Akshayakalpa sitemap now advertises a careers or jobs route')
    }

    const pageSitemap = await fetchPage(CRAWL_SURFACE_URLS[2])
    if (pageSitemap.status !== 200 || !hasOfficialPageSitemapSignal(pageSitemap.html)) {
      throw new Error('Akshayakalpa verified page sitemap surface no longer matches the known public surface')
    }
    if (hasCareerRouteInSitemap(pageSitemap.html)) {
      throw new Error('Akshayakalpa page sitemap now advertises a careers or jobs route')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Akshayakalpa verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAkshayakalpaScraper().run(options)

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
