import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runAirtelPaymentsBankNative } from './nativeCurrent20261113.js'

import { AIRTEL_PAYMENTS_BANK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AIRTEL_PAYMENTS_BANK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const PARENT_CAREERS_URL = PROVIDER_METADATA.parentCareersPage
export const SHARED_CAREERS_BUNDLE_URL = PROVIDER_METADATA.sharedCareersBundleUrl
export const SHARED_DARWINBOX_URL = PROVIDER_METADATA.sharedDarwinboxUrl
export const SHARED_CAREERS_API_URL = PROVIDER_METADATA.sharedCareersApiUrl

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob listings?\b/i,
  /\bjob postings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /darwinbox/i,
  /careersapi\.airtel\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = PARENT_CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const extractMainBundleUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/static\/js\/main\.[^"']+\.js)["']/i,
  )

  return toAbsoluteUrl(match?.[1], PARENT_CAREERS_URL)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Airtel Payments Bank: The Safe Second Account for Daily Transactions\s*<\/title>/i.test(page)
    && text.includes('Keep Your Main Account Safe')
    && text.includes('Open a Safe Second Account with Airtel Payments Bank')
    && text.includes('Empowering Indians, Everywhere.')
    && text.includes('News, Blogs & Awards')
    && text.includes('About Us')
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*About Us\s*\|\s*Airtel Payments Bank\s*<\/title>/i.test(page)
    && text.includes('About Airtel Payments Bank')
    && /As India['’]s first Payments Bank, we aim to give every Indian access to an equal, effective, and trustworthy banking experience\./i.test(text)
    && text.includes('Meet our board of directors')
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasCareersHandoffLink = (html = '') => (
  /href=["']https:\/\/careers\.airtel\.com\/["']/i.test(String(html ?? ''))
  || /href=["']https:\/\/www\.airtelpayments\.bank\.in\/(?:careers?|jobs?|openings?)(?:[/"'#?]|$)/i.test(String(html ?? ''))
  || /href=["']https:\/\/www\.airtel\.in\/careers(?:\/|["'#?]|$)/i.test(String(html ?? ''))
  || /href=["']https:\/\/airtel\.darwinbox\.in\/[^"']+["']/i.test(String(html ?? ''))
)

export const hasSharedAirtelCareersShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Airtel Careers\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Airtel Careers["']/i.test(page)
    && /<noscript>\s*You need to enable JavaScript to run this app\.\s*<\/noscript>/i.test(page)
    && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(page)
    && extractMainBundleUrl(page) !== null
}

export const hasAirtelPaymentsBankBundleReference = (bundleText = '') =>
  /\bAirtel Payments Bank\b/i.test(String(bundleText ?? ''))

export const hasDistinctAirtelPaymentsBankCareerRoute = (bundleText = '') =>
  /https:\/\/www\.airtelpayments\.bank\.in\/(?:careers?|jobs?|openings?)(?:[/"'#?]|$)/i.test(String(bundleText ?? ''))

export const hasVerifiedSharedBundleSignal = (bundleText = '') => {
  const bundle = String(bundleText ?? '')

  return hasAirtelPaymentsBankBundleReference(bundle)
    && !hasDistinctAirtelPaymentsBankCareerRoute(bundle)
    && /"darwinboxURL":"https:\/\/airtel\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs"/i.test(bundle)
    && /"apiUrl":"https:\/\/careersapi\.airtel\.com\/"/i.test(bundle)
}

export const hasSharedDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<base href="\/ms\/candidatev2\/">/i.test(page)
    && /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/i.test(page)
    && /db-components\.esm\.js/i.test(page)
}

export const createAirtelPaymentsBankScraper = () => ({
  run: runAirtelPaymentsBankNative,
})

export const run = async (options = {}) => createAirtelPaymentsBankScraper().run(options)

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
