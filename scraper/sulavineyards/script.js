import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SULA_VINEYARDS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

const PUBLIC_JOB_PATTERNS = [
  /\bopen roles\b/i,
  /\bcurrent openings\b/i,
  /\bapply now\b/i,
  /career-portal\/jobs\//i,
]

export const PROVIDER_METADATA = SULA_VINEYARDS_CATALOG
export const SOURCE = SULA_VINEYARDS_CATALOG.source
export const COMPANY = SULA_VINEYARDS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SULA_VINEYARDS_CATALOG.officialBrandName
export const VERIFIED_ON = SULA_VINEYARDS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SULA_VINEYARDS_CATALOG.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = SULA_VINEYARDS_CATALOG.officialCareersPageUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = SULA_VINEYARDS_CATALOG.officialCareersHandoffUrl

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
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractOfficialHROneHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/app\.hrone\.cloud\/career-portal\?[^"'`\s<>]*\bdc=sula\b[^"'`\s<>]*/i,
  )

  return match?.[0] ?? null
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Careers at Sula')
    && normalized.includes('As pioneers and leaders in the Indian wine industry')
    && normalized.includes('At Sula, we believe in a supportive, open-door culture')
    && normalized.includes('We have both full-time as well as internship positions available across all our departments.')
    && /\bView Open Positions\b/i.test(normalized)
    && extractOfficialHROneHandoffUrl(html) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const matchesVerifiedOpaqueHROneState = ({ status, url, html } = {}) => {
  const normalized = normalizeWhitespace(html)

  return Number(status) === 200
    && matchesExpectedUrl(url, OFFICIAL_CAREERS_HANDOFF_URL)
    && normalized === 'Your browser does not support JavaScript!'
    && !pageExposesPublicJobListings(html)
}

export const createSulaVineyardsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)

    if (
      Number(careersPage?.status) !== 200
      || !matchesExpectedUrl(careersPage?.url, CAREERS_PAGE_URL)
      || !hasOfficialCareersSignal(careersPage?.html)
    ) {
      throw new Error('The verified Sula Vineyards careers page changed materially')
    }

    if (extractOfficialHROneHandoffUrl(careersPage?.html) !== OFFICIAL_CAREERS_HANDOFF_URL) {
      throw new Error('The verified Sula Vineyards HROne handoff changed materially')
    }

    const handoffPage = await fetchPage(OFFICIAL_CAREERS_HANDOFF_URL)

    if (pageExposesPublicJobListings(handoffPage?.html)) {
      throw new Error(
        'The verified Sula Vineyards HROne handoff state changed materially and now appears to expose public jobs',
      )
    }

    if (matchesVerifiedOpaqueHROneState(handoffPage)) {
      return []
    }

    throw new Error('The verified Sula Vineyards HROne handoff state changed materially')
  },
})

export const run = async (options = {}) => createSulaVineyardsScraper().run(options)

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
