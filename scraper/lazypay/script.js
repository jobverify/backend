import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LAZYPAY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = LAZYPAY_CATALOG.source
export const COMPANY = LAZYPAY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = LAZYPAY_CATALOG.officialBrandName
export const VERIFIED_ON = LAZYPAY_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = LAZYPAY_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = LAZYPAY_CATALOG
export const HOMEPAGE_URL = LAZYPAY_CATALOG.homepageUrl
export const ABOUT_PAGE_URL = LAZYPAY_CATALOG.aboutPageUrl
export const PARENT_CAREERS_URL = LAZYPAY_CATALOG.parentCareersUrl
export const PARENT_JOB_BOARD_URL = LAZYPAY_CATALOG.parentJobBoardUrl
export const EXPECTED_404_URL = 'https://www.lazypay.in/404'
export const NO_PUBLIC_CAREER_ROUTE_URLS = [
  'https://www.lazypay.in/careers',
  'https://www.lazypay.in/jobs',
  'https://www.lazypay.in/join-us',
  'https://www.lazypay.in/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bopen jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview all open positions\b/i,
  /href=["'][^"']*\/jobs\/[^"']*["']/i,
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
  /icims/i,
  /taleo/i,
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
  }
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/â€™|â€˜/g, "'")
  .replace(/â€œ|â€�/g, '"')
  .replace(/Â©/g, '©')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && actualUrl.pathname.replace(/\/+$/, '') === expectedUrl.pathname.replace(/\/+$/, '')
  } catch {
    return false
  }
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return extractTitle(page) === 'About Us | Read More - LazyPay'
    && normalized.includes('We are part of PayU, a leading financial services provider in global growth markets.')
    && normalized.includes("India's Credit Super-app")
    && normalized.includes('LazyPay Private Limited is a part of PayU group')
    && normalized.includes('PayU Finance India Private Limited')
    && normalized.includes('wecare@lazypay.in')
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page.html ?? page.text ?? '')

  return Number(page.status) === 404
    && matchesExpectedUrl(page.url || '', EXPECTED_404_URL)
    && !pageExposesPublicJobListings(html)
}

export const createLazyPayScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const aboutPage = await fetchPage(ABOUT_PAGE_URL)
    if (Number(aboutPage.status) !== 200) {
      throw new Error('The verified about page for LazyPay no longer matches the exact-name PayU-affiliated surface')
    }

    if (pageExposesPublicJobListings(aboutPage.html)) {
      throw new Error('The exact-name LazyPay about page now appears to expose a first-party public jobs surface')
    }

    if (!hasOfficialAboutPageSignal(aboutPage.html)) {
      throw new Error('The verified about page for LazyPay no longer matches the exact-name PayU-affiliated surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREER_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`LazyPay verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLazyPayScraper().run(options)

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
