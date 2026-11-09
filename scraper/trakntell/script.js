import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TRAK_N_TELL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TRAK_N_TELL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&#8217;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { timeoutMs = 15000 } = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: createTimeoutSignal(timeoutMs),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
      errorKind: null,
      errorMessage: null,
    }
  } catch (error) {
    return {
      status: null,
      url,
      html: null,
      errorKind: error?.name === 'AbortError' ? 'timeout' : 'network',
      errorMessage: String(error?.cause?.code || error?.message || error),
    }
  }
}

export const hasOfficialHomepageSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()

  return page?.status === 200
    && page?.url === HOMEPAGE_URL
    && normalized.includes("experience india's 1st oem gps vehicle tracker")
    && normalized.includes('gps vehicle tracker')
    && normalized.includes('trak n tell mobile app')
    && normalized.includes('need support?')
    && normalized.includes('track your vehicle anywhere anytime')
    && normalized.includes('smart gps vehicle tracker')
    && normalized.includes('press')
    && normalized.includes('emi')
}

export const hasOfficialContactSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()

  return page?.status === 200
    && page?.url === CONTACT_URL
    && normalized.includes('contact us')
    && normalized.includes('get in touch')
    && normalized.includes('8010-80-8010')
    && normalized.includes('care@trakntell.com')
    && /gurugram|gurgaon/i.test(normalized)
}

export const hasPublicJobsSignal = (html = '') => (
  /(^|[^a-z])(careers?|jobs?)([^a-z]|$)/i.test(String(html ?? ''))
  || /open positions|job openings|work with us|apply now/i.test(String(html ?? ''))
  || /href=["'][^"']*\/careers?(?:\/|["'])/i.test(String(html ?? ''))
)

export const isExpectedBlockedSurface = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()
  const errorText = `${page?.errorKind ?? ''} ${page?.errorMessage ?? ''}`.toLowerCase()

  return page?.errorKind === 'timeout'
    || /connect timeout|und_err_connect_timeout|unable_to_verify_leaf_signature|certificate|tls/i.test(errorText)
    || (Number(page?.status) === 502 && normalized.includes('cannot connect'))
}

export const createTrakNTellScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('The verified product-contact-only state for Trak N Tell no longer matches the known public surface')
    }

    if (isExpectedBlockedSurface(homepage)) {
      const contactPage = await fetchPage(CONTACT_URL)
      if (hasPublicJobsSignal(contactPage.html)) {
        throw new Error('The verified product-contact-only state for Trak N Tell no longer matches the known public surface')
      }

      if (isExpectedBlockedSurface(contactPage)) {
        return []
      }
    }

    if (!hasOfficialHomepageSignal(homepage)) {
      throw new Error('The verified Trak N Tell homepage no longer matches the known product surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (hasPublicJobsSignal(contactPage.html)) {
      throw new Error('The verified product-contact-only state for Trak N Tell no longer matches the known public surface')
    }

    if (!hasOfficialContactSignal(contactPage)) {
      throw new Error('The verified Trak N Tell contact page no longer matches the known contact surface')
    }

    return []
  },
})

export const run = async (options = {}) => createTrakNTellScraper().run(options)

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
