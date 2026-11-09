import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SMALLCASE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bsee all jobs\b/i,
  /\bapply now\b/i,
  /\bjob id\b/i,
  /jobs\.pyjamahr\.com\/smallcase\/[a-z0-9-]+/i,
]

export const PROVIDER_METADATA = SMALLCASE_CATALOG
export const SOURCE = SMALLCASE_CATALOG.source
export const COMPANY = SMALLCASE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SMALLCASE_CATALOG.officialBrandName
export const VERIFIED_ON = SMALLCASE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SMALLCASE_CATALOG.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = SMALLCASE_CATALOG.officialCareersPageUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = SMALLCASE_CATALOG.officialCareersHandoffUrl
export const VERIFIED_SAMPLE_JOB_URL = SMALLCASE_CATALOG.verifiedSampleJobUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
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
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

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

export const extractOfficialPyjamaHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/app\.pyjamahr\.com\/careers\?company=smallcase(?:&|&amp;)company_uuid=2615584222/i,
  )

  return match?.[0]?.replace(/&amp;/gi, '&') ?? null
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Changing How India invests')
    && normalized.includes('Join us to shape tomorrow')
    && normalized.includes('Come work with us. Write in at work@smallcase.com')
    && extractOfficialPyjamaHandoffUrl(html) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const matchesVerifiedOpaquePyjamaState = ({ status, url, html } = {}) => {
  const normalized = normalizeWhitespace(html)

  return Number(status) === 200
    && matchesExpectedUrl(url, OFFICIAL_CAREERS_HANDOFF_URL)
    && normalized.includes('Careers at smallcase')
    && normalized.includes('Hiring Powered By')
    && normalized.includes('PyjamaHR')
    && normalized.includes('Department')
    && normalized.includes('Location')
    && !pageExposesPublicJobListings(html)
  }

export const createSmallcaseScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)

    if (
      Number(careersPage?.status) !== 200
      || !matchesExpectedUrl(careersPage?.url, CAREERS_PAGE_URL)
      || !hasOfficialCareersSignal(careersPage?.html)
    ) {
      throw new Error('The verified Smallcase About page changed materially')
    }

    if (extractOfficialPyjamaHandoffUrl(careersPage?.html) !== OFFICIAL_CAREERS_HANDOFF_URL) {
      throw new Error('The verified Smallcase PyjamaHR handoff changed materially')
    }

    const handoffPage = await fetchPage(OFFICIAL_CAREERS_HANDOFF_URL)

    if (pageExposesPublicJobListings(handoffPage?.html)) {
      throw new Error(
        'The verified Smallcase PyjamaHR handoff state changed materially and now appears to expose public jobs',
      )
    }

    if (matchesVerifiedOpaquePyjamaState(handoffPage)) {
      return []
    }

    throw new Error('The verified Smallcase PyjamaHR handoff state changed materially')
  },
})

export const run = async (options = {}) => createSmallcaseScraper(options).run(options)

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
