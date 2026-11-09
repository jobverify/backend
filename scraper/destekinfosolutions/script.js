import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DESTEK_INFOSOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DESTEK_INFOSOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APP_BUNDLE_URL = PROVIDER_METADATA.appBundleUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const LEGACY_CONTACT_ROUTE_URL = 'https://desteksolutions.com/contact'
export const MISSING_ROUTE_URLS = [
  LEGACY_CONTACT_ROUTE_URL,
  CAREERS_URL,
  'https://desteksolutions.com/career',
  'https://desteksolutions.com/jobs',
  'https://desteksolutions.com/job',
  'https://desteksolutions.com/join-us',
  'https://desteksolutions.com/openings',
  'https://desteksolutions.com/current-openings',
  'https://desteksolutions.com/work-with-us',
  ROBOTS_TXT_URL,
  SITEMAP_URL,
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
  /peoplestrong/i,
]

const FIRST_PARTY_CAREERS_ROUTE_PATTERNS = [
  /\/careers?(?:\/|["'#?\s]|$)/i,
  /\/jobs?(?:\/|["'#?\s]|$)/i,
  /\/join-us(?:\/|["'#?\s]|$)/i,
  /\/work-with-us(?:\/|["'#?\s]|$)/i,
  /\/openings?(?:\/|["'#?\s]|$)/i,
  /\/current-openings(?:\/|["'#?\s]|$)/i,
]

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
    headers: Object.fromEntries(response.headers.entries()),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Destek Infosolutions\s*<\/title>/i.test(page)
    && /<base[^>]+href=["']\/["'][^>]*>/i.test(page)
    && /<app-root\b[^>]*>\s*<\/app-root>/i.test(page)
    && /Destek-logo-final\.png/i.test(page)
    && /<script[^>]+src=["']runtime(?:-[^"']+)?\.js["'][^>]*>/i.test(page)
    && /<script[^>]+src=["']polyfills(?:-[^"']+)?\.js["'][^>]*>/i.test(page)
    && /<script[^>]+src=["']vendor(?:-[^"']+)?\.js["'][^>]*>/i.test(page)
    && /<script[^>]+src=["']main(?:-[^"']+)?\.js["'][^>]*>/i.test(page)
}

export const hasPublicCareersLink = (html = '') =>
  /href=["'][^"']*(careers|career|jobs|job)[^"']*["']/i.test(String(html ?? ''))

export const extractAppBundleUrl = (html = '', baseUrl = HOMEPAGE_URL) => {
  const match = String(html ?? '').match(/<script[^>]+src=["']([^"']*main(?:-[^"']+)?\.js)["'][^>]*>/i)
  if (!match) {
    return null
  }

  try {
    return new URL(match[1], baseUrl).toString()
  } catch {
    return null
  }
}

export const hasPublicJobsSignal = (text = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(text ?? '')))

export const hasFirstPartyCareerLikeRouteReference = (text = '') =>
  FIRST_PARTY_CAREERS_ROUTE_PATTERNS.some((pattern) => pattern.test(String(text ?? '')))

export const hasOfficialAppBundleSignal = (bundleText = '') => {
  const page = String(bundleText ?? '')

  return page.includes('Destek Infosolutions')
    && page.includes('contactus@desteksolutions.com')
    && page.includes('Office no 202B, Town Square, Off New Airport Road, Viman Nagar, Pune 411014')
    && page.includes('Custom Software Development')
    && page.includes('Head - HR & Operations')
}

export const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'desteksolutions.com' || hostname === 'www.desteksolutions.com'
  } catch {
    return false
  }
}

export const isExpectedMissingRoute = (response = {}) => {
  const status = Number(response?.status)
  const url = String(response?.url ?? '')
  const html = String(response?.html ?? '')

  return status === 404
    && isOfficialDomainUrl(url)
    && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
    && /The requested URL was not found on this server\./i.test(html)
    && !hasPublicJobsSignal(html)
    && !hasPublicCareersLink(html)
    && !hasFirstPartyCareerLikeRouteReference(html)
}

export const run = async ({ fetchPage = defaultFetchPage } = {}) => {
  const homepage = await fetchPage(HOMEPAGE_URL)
  if (homepage?.status !== 200 || !hasOfficialHomepageSignal(homepage?.html)) {
    throw new Error('Destek Infosolutions verified homepage SPA shell changed materially')
  }
  if (hasPublicCareersLink(homepage?.html) || hasPublicJobsSignal(homepage?.html)) {
    throw new Error('Destek Infosolutions homepage now appears to expose public jobs')
  }

  const appBundleUrl = extractAppBundleUrl(homepage?.html, homepage?.url || HOMEPAGE_URL)
  if (!appBundleUrl || appBundleUrl !== APP_BUNDLE_URL || !isOfficialDomainUrl(appBundleUrl)) {
    throw new Error('Destek Infosolutions verified homepage app bundle link changed materially')
  }

  const appBundle = await fetchPage(appBundleUrl)
  if (appBundle?.status !== 200 || !isOfficialDomainUrl(appBundle?.url || appBundleUrl) || !hasOfficialAppBundleSignal(appBundle?.html)) {
    throw new Error('Destek Infosolutions verified homepage app bundle changed materially')
  }
  if (hasPublicJobsSignal(appBundle?.html) || hasFirstPartyCareerLikeRouteReference(appBundle?.html)) {
    throw new Error('Destek Infosolutions homepage app bundle now appears to expose public jobs')
  }

  for (const routeUrl of MISSING_ROUTE_URLS) {
    const routePage = await fetchPage(routeUrl)
    if (!isExpectedMissingRoute(routePage)) {
      throw new Error(`Destek Infosolutions verified missing route changed materially: ${routeUrl}`)
    }
  }

  return []
}

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
