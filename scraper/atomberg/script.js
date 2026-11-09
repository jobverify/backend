import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ATOMBERG_CATALOG } from './catalog.js'
import{createCurrentSurfaceScraper}from'./currentSurface.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ATOMBERG_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_EMAIL = PROVIDER_METADATA.applicationEmail
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = PROVIDER_METADATA.noPublicJobRouteUrls
export const BROKEN_CAREER_ROUTE_URL = PROVIDER_METADATA.brokenCareerRouteUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview jobs\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjobs\.lever\.co\b/i,
  /\bboards\.greenhouse\.io\b/i,
  /\bjob-boards\.greenhouse\.io\b/i,
  /\bashbyhq\.com\b/i,
  /\bmyworkdayjobs\b/i,
  /\bworkdayjobs\b/i,
  /\bsmartrecruiters\b/i,
  /\bjobvite\b/i,
  /\bsuccessfactors\b/i,
  /\boraclecloud\b/i,
  /\bdarwinbox\b/i,
  /\bicims\b/i,
  /\btaleo\b/i,
  /\bpeoplestrong\b/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8217;|&#x2019;|&#x27;|&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/[’‘]/g, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1] ?? null)
}

const decodeCloudflareEmail = (value) => {
  const hex = String(value ?? '').trim()
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2 !== 0) {
    return null
  }

  const key = Number.parseInt(hex.slice(0, 2), 16)
  let email = ''

  for (let index = 2; index < hex.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16) ^ key)
  }

  return email || null
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

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractApplicationEmail = (html = '') => {
  const cloudflareEmail = String(html ?? '').match(/data-cfemail="([0-9a-f]+)"/i)?.[1]
  const decodedCloudflareEmail = decodeCloudflareEmail(cloudflareEmail)
  if (decodedCloudflareEmail) return decodedCloudflareEmail

  const mailtoEmail = String(html ?? '').match(/mailto:([^"'\s>]+)/i)?.[1]
  if (mailtoEmail) return normalizeWhitespace(mailtoEmail).toLowerCase()

  const textEmail = normalizeWhitespace(html).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  return textEmail ? textEmail.toLowerCase() : null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const hasVerifiedTitle = /<title>\s*Atomberg: Buy Best Ceiling Fans, Mixer Grinders &amp; Water Purifier\s*<\/title>/i.test(page)
  const hasLegacyHomepageContent = /Welcome to Atomberg!/i.test(text)
    && /real customer problems into modern solutions through tech-first innovation/i.test(text)
    && /Pan-India service network with on-site warranty/i.test(text)
    && /href=["']\/careers["']/i.test(page)
  const hasCurrentShopifyHomepageContent = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Atomberg["']/i.test(page)
    && /<meta[^>]+property=["']og:description["'][^>]+content=["'][^"']*Explore Atomberg/i.test(page)
    && /ceiling fans, mixer grinders, water purifier/i.test(page)
    && /href=["']\/(?:pages\/)?careers["']/i.test(page)

  return hasVerifiedTitle
    && (hasLegacyHomepageContent || hasCurrentShopifyHomepageContent)
    && !pageExposesPublicJobListings(page)
}

export const hasResumeOnlyCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const hasLegacyCareersTitle = /<title>\s*Atomberg- Join us in the journey of revolutionizing India(?:&#x27;|')s home appliances\s*<\/title>/i.test(page)
  const hasCurrentCareersTitle = /<title>\s*Careers at Atomberg \| Join Our Team\s*<\/title>/i.test(page)

  return (hasLegacyCareersTitle || hasCurrentCareersTitle)
    && /\bCAREERS\b/i.test(text)
    && /Interested candidates can share their updated resumes on/i.test(text)
    && extractApplicationEmail(page) === APPLICATION_EMAIL
    && !pageExposesPublicJobListings(page)
}

export const hasVerifiedNext404Route = (page = {}, requestedUrl) =>
  Number(page.status) === 404
  && page.url === requestedUrl
  && (
    (
      /<html[^>]+id=["']__next_error__["']/i.test(String(page.html ?? ''))
      && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex["']/i.test(String(page.html ?? ''))
      && /<meta[^>]+name=["']generator["'][^>]+content=["']Next\.js["']/i.test(String(page.html ?? ''))
    )
    || (
      /<title>\s*404 Not Found(?:\s*&ndash;\s*Atomberg)?\s*<\/title>/i.test(String(page.html ?? ''))
      && (
        /template\s*:\s*\{\s*name\s*:\s*['"]404['"]\s*,?\s*\}/i.test(String(page.html ?? ''))
        || /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/atomberg\.com\/404["']/i.test(String(page.html ?? ''))
      )
    )
  )
  && !pageExposesPublicJobListings(page.html)

export const hasVerifiedInternalServerErrorRoute = (page = {}, requestedUrl) =>
  (
    (
      Number(page.status) === 500
      && page.url === requestedUrl
      && extractTitle(page.html) === '500: Internal Server Error'
      && /500 Internal Server Error/i.test(normalizeWhitespace(page.html))
    )
    || hasVerifiedNext404Route(page, requestedUrl)
  )
  && !pageExposesPublicJobListings(page.html)


export const createAtombergScraper=defaults=>createCurrentSurfaceScraper({source:SOURCE,url:CAREERS_URL,canonicalUrl:'https://atomberg.com/pages/careers',title:/Careers at Atomberg \| Join Our Team/i,companySignal:'Careers',email:'career@atomberg.com',recruitingCopy:/Interested candidates can share their updated resumes on/i},defaults)

export const run = async (options = {}) => createAtombergScraper().run(options)

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
