import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

import TOKOPEDIA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\/candidate\/careers\/[^"'\s<]+/i,
]

export const PROVIDER_METADATA = TOKOPEDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const GOTO_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const TOKOPEDIA_REFERENCE_URL = PROVIDER_METADATA.officialCareersReferenceUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(String(value ?? ''))
    const expectedUrl = new URL(expected)
    const normalizePath = (pathname) => (pathname === '/' ? '/' : pathname.replace(/\/+$/, ''))

    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialGroupCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Temukan Peluang Karier Anda Telusuri Beragam Pilihan Karier di GoTo')
    && normalized.includes('0 pekerjaan tersedia di semua departemen dan di semua lokasi')
    && normalized.includes('Temukan pekerjaan di ekosistem kami')
    && normalized.includes('Karier di Gojek')
    && normalized.includes('Karier di GoTo Financial')
    && !normalized.includes('Tokopedia')
}

export const extractTokopediaDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/tokopedia\.darwinbox\.com\/ms\/candidate\/careers/i)
  return match ? match[0] : null
}

export const hasOpaqueTokopediaDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized === '-'
    || (
      /<base\s+href=["']\/ms\/candidate\/["']/i.test(page)
      && normalized.includes('Please enable Javascript!')
    )
}

export const hasAuthorizedTokopediaReferenceSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('caution: goto group | fake job listings - what you should be aware of')
    && normalized.includes('all authentic job postings from any of goto')
    && normalized.includes('official websites or their official linkedin pages')
    && normalized.includes('career sites')
    && normalized.includes('tokopedia career')
    && extractTokopediaDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const matchesVerifiedOpaqueDarwinboxState = ({ status, url, html } = {}) => (
  Number(status) === 200
  && matchesExpectedUrl(url, OFFICIAL_CAREERS_HANDOFF_URL)
  && hasOpaqueTokopediaDarwinboxShellSignal(html)
  && !pageExposesPublicJobListings(html)
)

export const createTokopediaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const groupCareersPage = await fetchPage(GOTO_CAREERS_URL)

    if (Number(groupCareersPage?.status) !== 200 || !matchesExpectedUrl(groupCareersPage?.url, GOTO_CAREERS_URL)) {
      throw new Error('Tokopedia verified GoTo careers page no longer matches the current shared-parent surface')
    }

    if (pageExposesPublicJobListings(groupCareersPage?.html)) {
      throw new Error('Tokopedia shared GoTo careers page now appears to expose public jobs')
    }

    if (!hasOfficialGroupCareersSignal(groupCareersPage?.html)) {
      throw new Error('Tokopedia verified GoTo careers page no longer matches the current shared-parent surface')
    }

    const referencePage = await fetchPage(TOKOPEDIA_REFERENCE_URL)

    if (Number(referencePage?.status) !== 200 || !matchesExpectedUrl(referencePage?.url, TOKOPEDIA_REFERENCE_URL)) {
      throw new Error('Tokopedia authorized Tokopedia handoff reference no longer matches the verified first-party surface')
    }

    if (pageExposesPublicJobListings(referencePage?.html)) {
      throw new Error('Tokopedia authorized Tokopedia handoff reference now appears to expose public jobs')
    }

    if (!hasAuthorizedTokopediaReferenceSignal(referencePage?.html)) {
      throw new Error('Tokopedia authorized Tokopedia handoff reference no longer matches the verified first-party surface')
    }

    const handoffPage = await fetchPage(OFFICIAL_CAREERS_HANDOFF_URL)

    if (!matchesVerifiedOpaqueDarwinboxState(handoffPage)) {
      throw new Error('Tokopedia opaque Darwinbox shell changed materially or now appears to expose public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createTokopediaScraper().run(options)

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
