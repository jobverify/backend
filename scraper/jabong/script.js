import path from 'node:path'
import { fileURLToPath } from 'node:url'

import JABONG_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\/jobs?\/[^"'\s<]+/i,
]

export const PROVIDER_METADATA = JABONG_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const EXPECTED_REDIRECT_URL = PROVIDER_METADATA.officialParentRedirectUrl

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

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedBrokenParentShellSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const hasBrokenShell = normalized.includes('Oops! Something went wrong')
    && normalized.includes('Please contact your administrator')
  const hasCurrentMyntraHomepageShell = normalized.includes('Online Shopping for Women, Men, Kids Fashion & Lifestyle - Myntra')
    && normalized.includes('Topwear')
    && normalized.includes('Indian & Festive Wear')

  return (hasBrokenShell || hasCurrentMyntraHomepageShell)
    && !pageExposesPublicJobListings(html)
}

export const matchesVerifiedJabongRedirectState = ({ status, url, html } = {}) => (
  Number(status) === 200
  && matchesExpectedUrl(url, EXPECTED_REDIRECT_URL)
  && hasVerifiedBrokenParentShellSignal(html)
)

export const createJabongScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (pageExposesPublicJobListings(homepage?.html)) {
      throw new Error('Jabong exact-name host now appears to expose a public jobs surface')
    }

    if (!matchesVerifiedJabongRedirectState(homepage)) {
      throw new Error('Jabong verified exact-name redirect surface no longer matches the known broken parent shell')
    }

    return []
  },
})

export const run = async (options = {}) => createJabongScraper().run(options)

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
