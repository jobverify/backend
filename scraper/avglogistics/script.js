import { createCurrentAvg } from "./currentPublic.js"
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AVG_LOGISTICS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AVG_LOGISTICS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = PROVIDER_METADATA.noPublicJobRouteUrls
export const OPERATIONS_PORTAL_URL = PROVIDER_METADATA.operationsPortalUrl
export const OPERATIONS_PORTAL_CAREERS_URL = PROVIDER_METADATA.operationsPortalCareersUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
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
  /career-page\/apply\//i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|span|a|button)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1] ?? null)
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

const extractJobRowSection = (html = '') => {
  const match = String(html ?? '').match(
    /<div class="row g-4">([\s\S]*?)<\/div>/i,
  )

  return match?.[1] ?? null
}

export const pageExposesPublicJobListings = (html = '') => {
  const page = String(html ?? '')

  if (PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(page))) {
    return true
  }

  if (/<div\b[^>]*class=["'][^"']*\bjob-card\b[^"']*["']/i.test(page)) {
    return true
  }

  return /href=["'][^"']*(?:\/jobs?\/[^"']+|\/careers\/[^"']*(?:job|apply)[^"']*)["']/i.test(page)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*Avg Logistics \|\| Green Logistics \|\| Transforming Supply Chains with Tomorrow(?:’|&#8217;|'|â€™)s Tech\.\s*<\/title>/i.test(page)
    && /Career at AVG/i.test(text)
    && /href=["']https:\/\/avglogistics\.com\/careers["']/i.test(page)
    && /AVG Logistics Limited/i.test(text)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*Avg Logistics \|\| Green Logistics \|\| Transforming Supply Chains with Tomorrow(?:’|&#8217;|'|â€™)s Tech\.\s*<\/title>/i.test(page)
    && /\bCareers\b/i.test(text)
    && /Join Us/i.test(text)
    && /Explore your Future/i.test(text)
    && /AVG/i.test(text)
    && /Easily apply to multiple jobs with one click/i.test(text)
}

export const hasUnqualifiedEmptyJobsSection = (html = '') => {
  const page = String(html ?? '')
  const rowSection = extractJobRowSection(page)

  return hasOfficialCareersSignal(page)
    && /<!--\s*Six job cards\s*-->/i.test(page)
    && rowSection != null
    && !/href=["'][^"']+["']/i.test(rowSection)
    && !/<div\b[^>]*class=["'][^"']*\bjob-card\b[^"']*["']/i.test(rowSection)
    && !pageExposesPublicJobListings(page)
}

// The reviewed HTML container has no native inventory count/model or published
// empty-state assertion. Its comment-only appearance never verifies absence.
export const hasVerifiedEmptyJobsSection = () => false

export const hasExpectedRobotsTxtSignal = (text = '') => {
  const normalized = String(text ?? '')

  return /User-agent:\s*\*/i.test(normalized)
    && /Disallow:\s*$/im.test(normalized)
    && /Sitemap:\s*https:\/\/www\.avglogistics\.com\/sitemap\.xml/i.test(normalized)
}

export const extractSitemapUrls = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) => match[1])

export const hasExpectedSitemapSignal = (xml = '') => {
  const urls = extractSitemapUrls(xml)

  return urls.includes(HOMEPAGE_URL)
    && urls.includes(CAREERS_URL)
}

export const hasVerified404Route = (page = {}, requestedUrl) =>
  Number(page.status) === 404
  && page.url === requestedUrl
  && extractTitle(page.html) === '404 Page Not Found'
  && /404 Page Not Found/i.test(stripTagsToText(page.html))
  && !pageExposesPublicJobListings(page.html)

export const hasOperationalPortalSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*AVG Logistics Limited\.\s*<\/title>/i.test(page)
    && /Track Your Parcel/i.test(text)
    && /Captcha\.aspx/i.test(page)
    && /btnLogin/i.test(page)
    && !pageExposesPublicJobListings(page)
}

export const hasOperationalPortal404 = (page = {}, requestedUrl) =>
  Number(page.status) === 404
  && page.url === requestedUrl
  && extractTitle(page.html) === '404 - File or directory not found.'
  && /Server Error/i.test(stripTagsToText(page.html))
  && /The resource you are looking for might have been removed/i.test(stripTagsToText(page.html))
  && !pageExposesPublicJobListings(page.html)

export const createAvgLogisticsScraper = () => createCurrentAvg()

export const run = async (options = {}) => createAvgLogisticsScraper().run(options)

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
