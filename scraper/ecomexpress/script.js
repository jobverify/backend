import { fetchVerifiedHttpsPage } from '../../scraper-support/utils/verifiedHttps.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ECOM_EXPRESS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ECOM_EXPRESS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_PAGE_URL = PROVIDER_METADATA.careerPageUrl
export const CHECKED_LANDING_PAGE_URLS = [...PROVIDER_METADATA.checkedLandingPageUrls]
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const DELHIVERY_CONTINUE_URL = PROVIDER_METADATA.delhiveryContinueUrl

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
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

export const fetchEcomExpressPage = (url, options = {}) => fetchVerifiedHttpsPage(url, {
  ...options, allowedOrigins: ['https://www.ecomexpress.in', 'https://ecomexpress.in'],
  headers: { 'User-Agent': USER_AGENT },
})

const defaultFetchPage = fetchEcomExpressPage

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasMergerLandingSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Delhivery X Ecom Express'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.ecomexpress\.in\/["'][^>]*\/?>/i.test(rawHtml)
    && normalized.includes('Better Together')
    && normalized.includes('Delhivery and Ecom Express Unite to Serve a Growing India.')
    && normalized.includes('Continue to Delhivery')
    && new RegExp(DELHIVERY_CONTINUE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(rawHtml)
}

const isVerifiedLandingPage = (page = {}) =>
  Number(page.status) === 200
  && hasMergerLandingSignal(page.html)
  && !hasPublicJobsSignal(page.html)

export const createEcomExpressScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!isVerifiedLandingPage(homepage)) {
      throw new Error('Ecom Express verified homepage no longer matches the known merger landing page')
    }

    for (const routeUrl of CHECKED_LANDING_PAGE_URLS.slice(1)) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedLandingPage(routePage)) {
        throw new Error(`Ecom Express verified landing page route changed: ${routeUrl}`)
      }
    }

    const robotsPage = await fetchPage(ROBOTS_TXT_URL)

    if (!isVerifiedLandingPage(robotsPage)) {
      throw new Error('Ecom Express verified robots.txt changed')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)

    if (!isVerifiedLandingPage(sitemapPage)) {
      throw new Error('Ecom Express verified sitemap changed')
    }

    return []
  },
})

export const run = async (options = {}) => createEcomExpressScraper().run(options)

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
