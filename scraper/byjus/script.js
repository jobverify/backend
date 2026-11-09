import { runCurrentByjus } from './currentPublic.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BYJUS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BYJUS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_PAGE_URL = PROVIDER_METADATA.careerPageUrl
export const SALES_CATEGORY_ROUTE_URL = PROVIDER_METADATA.salesCategoryRouteUrl
export const SALES_APPLY_URL = PROVIDER_METADATA.salesApplyUrl
export const MISDIRECTED_TECH_ROUTE_URL = PROVIDER_METADATA.misdirectedTechRouteUrl
export const MISDIRECTED_TECH_FINAL_URL = PROVIDER_METADATA.misdirectedTechFinalUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const CHECKED_MISSING_ROUTE_URLS = [...PROVIDER_METADATA.checkedMissingRouteUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
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
  .replace(/&#39;|&#039;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'byjus.com' || hostname === 'www.byjus.com'
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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === "BYJU'S Online learning Programs For K3, K10, K12, NEET, JEE, UPSC & Bank Exams"
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/byjus\.com\/["']/i.test(rawHtml)
    && /<body[^>]+class=["'][^"']*\bhome\b[^"']*["']/i.test(rawHtml)
    && normalized.includes("BYJU'S Online learning Programs")
    && normalized.includes('NEET, JEE, UPSC & Bank Exams')
}

export const hasCareerLandingSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/byjus\.com\/careers-at-byjus\/["']/i.test(rawHtml)
    && /page-template-careers_at_byjus/i.test(rawHtml)
    && /Careers at BYJU'S|Careers at BYJUS/i.test(rawHtml)
    && normalized.includes('View all Jobs')
    && normalized.includes('View Jobs')
    && normalized.includes('recruitments@byjus.com')
    && /https:\/\/byjus\.com\/careers\/all-openings\/job-category\/tech\//i.test(rawHtml)
    && /https:\/\/byjus\.com\/careers\/all-openings\/job-category\/sales\//i.test(rawHtml)
}

export const hasGenericSalesApplySignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return (
      /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/byjus\.com\/sales-apply\/["']/i.test(rawHtml)
      || /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/byjus\.com\/sales-apply\/["']/i.test(rawHtml)
    )
    && /page-template-sales-apply/i.test(rawHtml)
    && /id=["']sales-apply-form["']/i.test(rawHtml)
    && /https:\/\/web\.mxradon\.com\/t\/FormTracker\.aspx/i.test(rawHtml)
    && normalized.includes('career in Sales')
    && normalized.includes('Unprecedented Job Perks')
}

export const extractCareerLikeUrlsFromSitemap = (sitemapXml = '') => (
  [...String(sitemapXml ?? '').matchAll(/https:\/\/byjus\.com\/[^<\s]+/gi)]
    .map((match) => match[0].replace(/&amp;/gi, '&'))
    .filter((url) => /\/(?:careers?-at-byjus|careers?|jobs?|join-us|openings)(?:[/?#]|$)/i.test(url))
)

export const isMissingCareerRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && extractTitle(page.html) === "Page not found - BYJU'S"
  && !hasPublicJobsSignal(page.html)

export const isMisdirectedTechRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page.status) === 200
    && page.url === MISDIRECTED_TECH_FINAL_URL
    && /<body[^>]+class=["'][^"']*\bslug-technetium\b[^"']*["']/i.test(rawHtml)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/byjus\.com\/chemistry\/technetium\/["']/i.test(rawHtml)
    && normalized.includes('Technetium')
    && !hasPublicJobsSignal(rawHtml)
}

export const isGenericSalesApplyRoute = (page = {}) =>
  Number(page.status) === 200
  && page.url === SALES_APPLY_URL
  && hasGenericSalesApplySignal(page.html)
  && !hasPublicJobsSignal(page.html)

export const createByjusScraper = (defaults = {}) => ({ run: (options = {}) => runCurrentByjus({ ...defaults, ...options }) })

export const run = async (options = {}) => createByjusScraper().run(options)

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
