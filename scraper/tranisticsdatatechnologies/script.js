import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

import { TRANISTICS_DATA_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TRANISTICS_DATA_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const CAREERS_ROUTE_URLS = [
  'https://www.tranistics.com/careers/',
  'https://www.tranistics.com/careers',
  'https://www.tranistics.com/jobs/',
  'https://www.tranistics.com/jobs',
  'https://www.tranistics.com/join-us/',
  'https://www.tranistics.com/openings/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bcareer opportunities\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /myworkdayjobs/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const createTimeoutSignal = (timeoutMs) => {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(timeoutMs)
  return undefined
}

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /Web Accessibility, Marketing & Data Solutions \| Tranistics/i.test(page)
    && normalized.includes('your business. our responsibility.')
    && normalized.includes('tranistics: revolutionizing transportation and logistics')
    && normalized.includes('copyright © 2026 tranistics data technologies pvt. ltd')
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /Contact Us - Tranistics Data Technologies/i.test(page)
    && normalized.includes('contact us')
    && normalized.includes('info@tranistics.com')
    && normalized.includes('kolkata')
    && normalized.includes('noida')
}

const isVerifiedMissingFirstPartyRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeText(html)

  return page.status === 404
    && (
      /<title>\s*Not Found\s*<\/title>/i.test(html)
      || /<title>\s*Page not found - Tranistics Data Technologies\s*<\/title>/i.test(html)
    )
    && (
      normalized.includes('404')
      || normalized.includes('page not found')
    )
    && !hasPublicJobsSignal(html)
}

export const createTranisticsDataTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Tranistics Data Technologies homepage surface no longer matches the verified first-party site')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Tranistics Data Technologies homepage now appears to expose public jobs')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Tranistics Data Technologies contact page no longer matches the verified first-party site')
    }
    if (hasPublicJobsSignal(contactPage.html)) {
      throw new Error('Tranistics Data Technologies contact page now appears to expose public jobs')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedMissingFirstPartyRoute(careersRoute)) {
        throw new Error(`Tranistics Data Technologies careers route changed materially or now exposes public jobs: ${careersRouteUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTranisticsDataTechnologiesScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
