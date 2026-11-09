import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SAFEEXPRESS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_URL = PROVIDER_METADATA.verifiedContactPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/[‐-―]/g, '-')
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

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const hasPrimaryNav = /Home\b.*About\b.*Services\b.*(?:Carriers\b.*)?Contact\b.*Track your Cargo/i.test(text)

  return /<title>\s*Home-SAFE EXPRESS\s*<\/title>/i.test(page)
    && hasPrimaryNav
    && text.includes('SAFE EXPRESS')
    && text.includes('Your Lightning Fast Delivery Partner')
    && text.includes('We are a privately owned company that provides top-notch customs clearing and forwarding solutions.')
    && text.includes('Phone: (+91) 033-40106890')
    && text.includes('Email: info@safeexpress.in')
}

export const hasOfficialContactSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Contact-SafeExpress\s*<\/title>/i.test(page)
    && text.includes('Contact')
    && text.includes('(+91) 033-40106890')
    && text.includes('3,B.N SARKAR SARANI (FORMERLY: CHOWRINGHEE APPROACH) "BASU HOUSE" 2ND FLOOR, KOLKATA - 700072')
    && text.includes('info@safeexpress.in')
    && text.includes('SAFE EXPRESS')
}

export const hasPublicJobsSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return /careers/i.test(text)
    || /current openings/i.test(text)
    || /job openings/i.test(text)
    || /apply now/i.test(text)
    || /send your resume/i.test(text)
    || /join our team/i.test(text)
}

export const createSafeExpressScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('SafeExpress surface now appears to expose public jobs')
    }

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('SafeExpress verified official homepage no longer matches the trusted first-party surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (hasPublicJobsSignal(contactHtml)) {
      throw new Error('SafeExpress surface now appears to expose public jobs')
    }

    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('SafeExpress verified contact page no longer matches the trusted first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSafeExpressScraper().run(options)

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
