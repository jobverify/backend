import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SIMPL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SIMPL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const CAREERS_REFERENCE_PAGE_URL = PROVIDER_METADATA.careersReferencePageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcurrent openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview all jobs\b/i,
  /\bcareers? at\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'simpl-official',
  timeoutMs: 15000,
})

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasLinkedFirstPartyCareersRoute = (html = '') => {
  const rawHtml = String(html ?? '')

  return /href=["']https:\/\/www\.get-simpl\.com\/(?:careers?|jobs?)(?:\.html)?["']/i.test(rawHtml)
    || /href=["']\/(?:careers?|jobs?)(?:\.html)?["']/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = (normalizeWhitespace(rawHtml) || '').toLowerCase()

  return /<title[^>]*>\s*Simpl\s*[—-]\s*India's Leading 1-Tap Checkout Network\s*<\/title>/i.test(rawHtml)
    && normalized.includes('payments made invisible. money made intelligent.')
    && normalized.includes('simpl (one sigma) is a fintech company')
    && normalized.includes("india's #1 checkout network")
    && normalized.includes('careers')
  }

export const hasOfficialAboutSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = (normalizeWhitespace(rawHtml) || '').toLowerCase()

  return /<title[^>]*>\s*About Us\s*[—-]\s*Simpl\s*<\/title>/i.test(rawHtml)
    && normalized.includes('about simpl')
    && normalized.includes('reimagining credit for the mobile era.')
    && normalized.includes('simpl (one sigma) is a fintech company')
    && normalized.includes('customer first')
    && normalized.includes('radical simplicity')
  }

export const hasOfficialCareersReferenceSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = (normalizeWhitespace(rawHtml) || '').toLowerCase()

  return /<title>\s*About Simpl - India's Leading 1-tap Checkout Network!\s*<\/title>/i.test(rawHtml)
    && normalized.includes('careers with simpl')
    && normalized.includes('reinvent the world of commerce with us.')
    && normalized.includes('join us')
    && normalized.includes('the simpl app')
  }

export const createSimplScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Simpl homepage no longer matches the verified first-party surface')
    }
    if (hasLinkedFirstPartyCareersRoute(homepageHtml)) {
      throw new Error('Simpl homepage now exposes a first-party careers route')
    }
    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('Simpl homepage now exposes a trustworthy public jobs surface')
    }

    const aboutHtml = await fetchText(ABOUT_PAGE_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Simpl about page no longer matches the verified first-party surface')
    }
    if (hasLinkedFirstPartyCareersRoute(aboutHtml) || hasPublicJobsSignal(aboutHtml)) {
      throw new Error('Simpl about page now exposes a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSimplScraper().run(options)

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
