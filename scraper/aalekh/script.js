import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runAalekhPublicRead } from './currentPublic.js'

import { AALEKH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AALEKH_CATALOG.source
export const COMPANY = AALEKH_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AALEKH_CATALOG.officialBrandName
export const VERIFIED_ON = AALEKH_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AALEKH_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AALEKH_CATALOG
export const HOMEPAGE_URL = AALEKH_CATALOG.companyCareerPage
export const CONTACT_URL = AALEKH_CATALOG.contactPageUrl
export const ROBOTS_TXT_URL = AALEKH_CATALOG.robotsTxtUrl
export const SITEMAP_URL = AALEKH_CATALOG.sitemapUrl
export const CAREERS_ROUTE_URLS = [
  'https://aalekh.co/careers',
  'https://aalekh.co/career',
  'https://aalekh.co/jobs',
  'https://aalekh.co/job',
  'https://aalekh.co/join-us',
  'https://aalekh.co/openings',
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
  /\bwe(?:'re| are)? hiring\b/i,
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
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
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
    return hostname === 'aalekh.co' || hostname === 'www.aalekh.co'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?aalekh\.co)?\/(?:career|careers|jobs?|join-us|openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Aalekh Designs,\s*Rajkot\s*\|[\s\S]*Packaging Designer in Rajkot[\s\S]*<\/title>/i.test(rawHtml)
    && normalized.includes('hello namasthe !')
    && normalized.includes('creative and unique design')
    && normalized.includes('we are more than just a creative agency! as a premier designing hub in rajkot (gujarat - india), aalekh designs develops logos, catalogues & brochures, attractive corporate identity, packaging design & stationery design along with web development.')
    && normalized.includes('our designs are always exclusively designed for you.')
    && normalized.includes('get in touch')
}

export const hasOfficialContactSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Aalekh Designs Rajkot[\s\S]*<\/title>/i.test(rawHtml)
    && normalized.includes('get in touch.')
    && normalized.includes('contact us')
    && normalized.includes('call us')
    && normalized.includes('+91 88667 88663')
    && normalized.includes('email us')
    && normalized.includes('info@aalekh.co')
    && normalized.includes('address')
    && normalized.includes('rajkot, gujarat')
    && normalized.includes('contact form')
    && /sendmail/i.test(rawHtml)
}

export const isVerifiedMissingFirstPartyRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeText(rawHtml)

  return page.status === 404
    && isOfficialDomainUrl(page.url || '')
    && /<title>\s*Not Found\s*<\/title>/i.test(rawHtml)
    && normalized.includes('404')
    && normalized.includes('not found')
    && !hasPublicJobsSignal(rawHtml)
    && !hasFirstPartyCareerLikeLink(rawHtml)
}

export const createAalekhScraper = () => ({
  run: runAalekhPublicRead,
})

export const run = async (options = {}) => createAalekhScraper().run(options)

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
