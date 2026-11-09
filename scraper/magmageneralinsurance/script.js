import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MAGMA_GENERAL_INSURANCE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ALTERNATE_CAREERS_URL = PROVIDER_METADATA.alternateCareerPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNAVAILABLE_ERROR_PATTERN =
  /timed out|timeout|operation was aborted due to timeout|connect timeout|und_err_connect_timeout|fetch failed|econnreset|unable to|getaddrinfo|enotfound|http 429|http 500|http 502|http 503|http 504/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const isVerifiedMagmaUnavailableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNAVAILABLE_ERROR_PATTERN.test(message)
    || UNAVAILABLE_ERROR_PATTERN.test(causeCode)
    || UNAVAILABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchTextSafely = async (fetchText, url) => {
  try {
    return {
      html: await fetchText(url),
      error: null,
    }
  } catch (error) {
    if (!isVerifiedMagmaUnavailableError(error)) throw error

    return {
      html: null,
      error,
    }
  }
}

export const hasPublicJobListingsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /\b(current openings|open positions|job openings|search jobs|view jobs|view openings|open roles)\b/i.test(text)
    || /\breq(?:uisition)? id\b/i.test(text)
    || /<a[^>]+href=["'][^"']*\/jobs\/[^"']*["'][^>]*>\s*apply now\s*<\/a>/i.test(page)
}

export const hasPrimaryCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title[^>]*>\s*General Insurance Company India \| Careers\s*&(?:amp;)?\s*Opportunities - Magma Insurance(?:\s*-\s*Magma)?\s*<\/title>/i.test(page)
    && text.includes('Careers')
    && text.includes('Be a part of the Magma family!')
    && text.includes('Apply for Job')
    && text.includes('Educational Qualification')
    && text.includes('Insurance Experience')
    && text.includes('Location')
    && text.includes('Upload CV')
}

export const hasAlternateCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title[^>]*>\s*Career(?:s)?(?:\s*&(?:amp;)?\s*Opportunities)? - Magma Insurance(?:\s*-\s*Magma)?\s*<\/title>/i.test(page)
    && text.includes('Careers')
    && text.includes('Apply for Job')
    && text.includes('Insurance Experience')
    && text.includes('Location')
    && text.includes('Upload CV')
}

export const createMagmaGeneralInsuranceScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const primaryResult = await fetchTextSafely(fetchText, CAREERS_URL)
    const primaryCareersHtml = primaryResult.html
    if (primaryCareersHtml && hasPublicJobListingsSignal(primaryCareersHtml)) {
      throw new Error('Magma General Insurance surface now appears to expose public job listings')
    }

    if (primaryCareersHtml && !hasPrimaryCareersSignal(primaryCareersHtml)) {
      throw new Error(
        'Magma General Insurance verified primary careers page no longer matches the trusted first-party application form',
      )
    }

    const alternateResult = await fetchTextSafely(fetchText, ALTERNATE_CAREERS_URL)
    const alternateCareersHtml = alternateResult.html
    if (alternateCareersHtml && hasPublicJobListingsSignal(alternateCareersHtml)) {
      throw new Error('Magma General Insurance surface now appears to expose public job listings')
    }

    if (alternateCareersHtml && !hasAlternateCareersSignal(alternateCareersHtml)) {
      throw new Error(
        'Magma General Insurance verified alternate careers page no longer matches the trusted first-party application form',
      )
    }

    if (primaryResult.error || alternateResult.error) {
      return []
    }

    return []
  },
})

export const run = async (options = {}) => createMagmaGeneralInsuranceScraper().run(options)

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
