import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runAavishkarPublicRead } from './currentPublic.js'

import { provider as PROVIDER_METADATA } from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export { PROVIDER_METADATA }
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const CAREERS_ROUTE_URLS = [
  'https://aavishkaargroup.com/careers/',
  'https://aavishkaargroup.com/career/',
  'https://aavishkaargroup.com/jobs/',
  'https://aavishkaargroup.com/job/',
  'https://aavishkaargroup.com/join-us/',
  'https://aavishkaargroup.com/work-with-us/',
  'https://aavishkaargroup.com/openings/',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)\s+hiring\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
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
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;|\u2013|\u2014/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'aavishkaargroup.com' || hostname === 'www.aavishkaargroup.com'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?aavishkaargroup\.com)?\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Aavishkaar Group: One of the largest Impact Platforms across the Global South\s*<\/title>/i.test(rawHtml)
    && normalized.includes('we exist to bridge the opportunity gap for the emerging 3 billion')
    && normalized.includes('we do this by emboldening entrepreneurs or becoming one.')
    && normalized.includes('building impact investing ecosystems')
    && /140 mn\+\s+underserved customers(?:\s+\([^)]+\))?\s+supported through our investments and engagements/i.test(normalized)
    && normalized.includes('latest news')
    && /href=["']https:\/\/aavishkaargroup\.com\/contact-us\/["']/i.test(rawHtml)
}

export const hasOfficialContactPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Contact Us - Aavishkaar Group\s*<\/title>/i.test(rawHtml)
    && normalized.includes('get in touch')
    && normalized.includes('info@aavishkaargroup.com')
    && normalized.includes('mumbai')
    && normalized.includes('bandra kurla complex')
    && normalized.includes('delhi')
    && normalized.includes('whitehouse nbcc plaza')
    && normalized.includes('nairobi')
}

export const hasOpenRobotsSignal = (text) => {
  const normalized = String(text ?? '')

  return /User-agent:\s*\*/i.test(normalized)
    && /Disallow:\s*$/im.test(normalized)
    && /Sitemap:\s*https:\/\/aavishkaargroup\.com\/sitemap_index\.xml/i.test(normalized)
    && /YOAST BLOCK/i.test(normalized)
}

export const hasVerifiedSitemapIndex = (xml) => {
  const normalized = String(xml ?? '')

  return /<sitemapindex\b/i.test(normalized)
    && /https:\/\/aavishkaargroup\.com\/page-sitemap\.xml/i.test(normalized)
    && /https:\/\/aavishkaargroup\.com\/group-companies-sitemap\.xml/i.test(normalized)
    && /Yoast SEO/i.test(normalized)
}

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeText(rawHtml)

  return Number(page.status) === 404
    && isOfficialDomainUrl(page.url || '')
    && /<title>\s*Page not found \| Aavishkaar\s*<\/title>/i.test(rawHtml)
    && normalized.includes('404')
    && normalized.includes('page not found')
    && normalized.includes("we're sorry, we couldn't find the page you requested")
    && !hasPublicJobsSignal(rawHtml)
    && !hasFirstPartyCareerLikeLink(rawHtml)
}

export const createAavishkarScraper = () => ({ run: runAavishkarPublicRead })

export const run = async (options = {}) => createAavishkarScraper().run(options)

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
