import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

import SHADOWFAX_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SHADOWFAX_CATALOG.source
export const COMPANY = SHADOWFAX_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SHADOWFAX_CATALOG.officialBrandName
export const LEGAL_ENTITY_NAME = SHADOWFAX_CATALOG.legalEntityName
export const VERIFIED_ON = SHADOWFAX_CATALOG.verifiedOn
export const PROVIDER_METADATA = SHADOWFAX_CATALOG
export const HOMEPAGE_URL = SHADOWFAX_CATALOG.homepageUrl
export const CAREERS_URL = SHADOWFAX_CATALOG.companyCareerPage
export const CAREERS_ROUTE_URLS = SHADOWFAX_CATALOG.checkedNoPublicJobsRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#0*39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#8216;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const isSameOfficialDomain = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'shadowfax.in' || hostname === 'www.shadowfax.in'
  } catch {
    return false
  }
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

export const extractCareersUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a[^>]+href=["']([^"']*\/careers)["'][^>]*>\s*Careers\s*<\/a>/i,
  )

  if (!match?.[1]) return null

  try {
    return new URL(match[1], HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Shadowfax - Best Indian Logistics Company for Express Deliveries\s*<\/title>/i.test(page)
    && normalized.includes("India's Trusted Partner for Fast, Reliable Delivery")
    && normalized.includes('Your trusted partner for express parcel delivery, returns, same-day, next-day, 30-minute delivery, and fulfilment solutions.')
    && extractCareersUrl(page) === CAREERS_URL
    && normalized.includes('Shadowfax Technologies Limited')
}

export const hasVerifiedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Build Your Career at a Leading Logistics Company\s*\|\s*Shadowfax\s*<\/title>/i.test(page)
    && normalized.includes('Join the Shadowfax Team!')
    && normalized.includes("Join a team of passionate people moving the world forward. We're hiring those who want to help shape the future of logistics with us.")
    && normalized.includes('Our Openings')
    && normalized.includes('Shadowfax Technologies Limited')
}

export const hasEmptyOpeningsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('No job openings available at the moment.')
    && normalized.includes('Join our talent pool')
    && normalized.includes("Couldn't find a suitable vacancy?")
    && normalized.includes("Upload your CV and we'll get back to you when something opens up")
    && normalized.includes('Preffered department')
}

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  if (!isSameOfficialDomain(page.url || HOMEPAGE_URL)) {
    return false
  }

  const html = String(page.html ?? '')
  if (/apply now|open positions|jobview|job openings/i.test(html)) {
    return false
  }

  return page.status === 404
    && /<title>\s*Page Not Found \(404\)\s*\|\s*Shadowfax\s*\|\s*Shadowfax\s*<\/title>/i.test(html)
  }

export const createShadowfaxScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
      throw new Error('The verified Shadowfax homepage no longer matches the trusted public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasVerifiedCareersSignal(careersPage.html)) {
      throw new Error('The verified Shadowfax careers page no longer matches the trusted public surface')
    }

    if (!hasEmptyOpeningsSignal(careersPage.html)) {
      throw new Error('The verified empty openings state no longer matches the trusted public surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedNoPublicJobsRoute(careersRoute)) {
        throw new Error('Shadowfax adjacent careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createShadowfaxScraper().run(options)

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
