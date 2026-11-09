import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FYLE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FYLE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const RESOLVED_CAREERS_URL = PROVIDER_METADATA.resolvedCareerPageUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_ROUTE_URLS = [...PROVIDER_METADATA.checkedMissingRouteUrls]

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
  /peoplestrong/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return null
  }
}

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractHomepageCareersUrl = (html = '') => {
  const match = String(html ?? '').match(/<a[^>]+href=["']([^"']*company\/team\/join[^"']*)["'][^>]*>\s*Careers\s*<\/a>/i)
  return match?.[1] ? toAbsoluteUrl(match[1], HOMEPAGE_URL) : null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Expense Tracking Software for Receipt and Expense Management\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Real-time expense management on your existing credit cards')
    && normalized.includes('With Sage Expense Management (formerly Fyle), your team just texts a receipt')
    && normalized.includes('No new cards. No extra effort. Just faster closes')
    && extractHomepageCareersUrl(rawHtml) === RESOLVED_CAREERS_URL
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Sage Expense Management \(formerly Fyle\) \| Join our team\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.fylehq\.com\/company\/team\/join["']/i.test(rawHtml)
    && normalized.includes('Come work with us')
    && normalized.includes('Help us on our mission to make expense management fast, efficient and employee-friendly.')
    && normalized.includes('What working at Sage Expense Management (formerly Fyle) feels like')
    && normalized.includes('Life at Sage Expense Management (formerly Fyle)')
    && !hasPublicJobsSignal(rawHtml)
}

export const hasExpectedRobotsTxtSignal = (text = '') => {
  const normalized = String(text ?? '')

  return /User-agent:\s*\*/i.test(normalized)
    && /Allow:\s*\/\s*$/im.test(normalized)
    && /Allow:\s*\/blog\//i.test(normalized)
    && /Disallow:\s*\/thank-you/i.test(normalized)
    && /Sitemap:\s*https:\/\/www\.fylehq\.com\/sitemap(?:-index)?\.xml/i.test(normalized)
}

export const extractCareerLikeUrlsFromSitemap = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>(.*?)<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url) => /\/(?:career|careers|jobs?|join|openings|work-with-us)(?:$|[/?#])/i.test(url))

export const isMissingCareerRoute = (page = {}) =>
  Number(page.status) === 404
  && /<title>\s*404-\s*Page not found \| Sage Expense Management \(formerly Fyle\)\s*<\/title>/i.test(String(page.html ?? ''))
  && /Oops!\s*Missing page\s*:\(/i.test(String(page.html ?? ''))
  && !hasPublicJobsSignal(page.html)

export const createFyleScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Fyle verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Fyle homepage now appears to expose public jobs')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || normalizeUrl(careersPage.url) !== RESOLVED_CAREERS_URL
      || !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Fyle verified careers page changed materially or no longer matches the known public surface')
    }

    const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
    if (robotsTxt.status !== 200 || !hasExpectedRobotsTxtSignal(robotsTxt.html)) {
      throw new Error('Fyle verified robots.txt no longer matches the known public surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    const careerLikeUrls = extractCareerLikeUrlsFromSitemap(sitemap.html)
    if (
      sitemap.status !== 200
      || careerLikeUrls.length !== 1
      || normalizeUrl(careerLikeUrls[0]) !== RESOLVED_CAREERS_URL
    ) {
      throw new Error('Fyle verified sitemap no longer matches the known public surface')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Fyle verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createFyleScraper().run(options)

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
