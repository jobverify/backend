import path from 'node:path'
import { fileURLToPath } from 'node:url'

import TIVO_INDIA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\/careers\/job/i,
]

export const PROVIDER_METADATA = TIVO_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const BRAND_HOMEPAGE_URL = PROVIDER_METADATA.officialBrandHomepageUrl
export const SHARED_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const LOCATIONS_URL = PROVIDER_METADATA.officialLocationsPageUrl

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&copy;/gi, '(c)')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
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

export const hasOfficialTiVoHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return normalized.includes('with tivo, the choice is always yours.')
    && normalized.includes('a smart tv powered by tivo gives you the power to choose what you want to watch.')
    && normalized.includes('xperi inc.')
    && normalized.includes('all rights reserved.')
    && /href=["']https:\/\/(?:www\.)?xperi\.com\/careers\/?["']/i.test(rawHtml)
    && /href=["']https:\/\/(?:www\.)?xperi\.com\/company\/?["']/i.test(rawHtml)
}

export const hasSharedXperiCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers')
    && normalized.includes('extraordinary opportunities await.')
    && normalized.includes('through our brands')
    && normalized.includes('tivo')
    && normalized.includes('search jobs')
    && (normalized.includes('view openings') || normalized.includes('open positions'))
    && normalized.includes('life @ xperi')
}

export const hasIndiaLocationsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Filter by Country Australia China India Ireland Japan Mexico Poland Singapore South Korea Sweden Taiwan United Kingdom United States')
    && normalized.includes('Xperi Bangalore')
    && normalized.includes('Bangalore, India 560103')
    && normalized.includes('Xperi Pune')
    && normalized.includes('Pune, Maharashtra, India 411014')
}

export const createTiVoIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(BRAND_HOMEPAGE_URL)

    if (Number(homepage?.status) !== 200 || !matchesExpectedUrl(homepage?.url, BRAND_HOMEPAGE_URL)) {
      throw new Error('TiVo India verified TiVo homepage no longer matches the known first-party surface')
    }

    if (pageExposesPublicJobListings(homepage?.html)) {
      throw new Error('TiVo India TiVo homepage now appears to expose public jobs')
    }

    if (!hasOfficialTiVoHomepageSignal(homepage?.html)) {
      throw new Error('TiVo India verified TiVo homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(SHARED_CAREERS_URL)

    if (Number(careersPage?.status) !== 200 || !matchesExpectedUrl(careersPage?.url, SHARED_CAREERS_URL)) {
      throw new Error('TiVo India shared Xperi careers page no longer matches the verified shared-parent surface')
    }

    if (pageExposesPublicJobListings(careersPage?.html)) {
      throw new Error('TiVo India shared Xperi careers surface now appears to expose public jobs')
    }

    if (!hasSharedXperiCareersSignal(careersPage?.html)) {
      throw new Error('TiVo India shared Xperi careers page no longer matches the verified shared-parent surface')
    }

    const locationsPage = await fetchPage(LOCATIONS_URL)

    if (Number(locationsPage?.status) !== 200 || !matchesExpectedUrl(locationsPage?.url, LOCATIONS_URL)) {
      throw new Error('TiVo India Xperi India locations page no longer matches the verified shared-parent surface')
    }

    if (pageExposesPublicJobListings(locationsPage?.html)) {
      throw new Error('TiVo India Xperi India locations surface now appears to expose public jobs')
    }

    if (!hasIndiaLocationsSignal(locationsPage?.html)) {
      throw new Error('TiVo India Xperi India locations page no longer matches the verified shared-parent surface')
    }

    return []
  },
})

export const run = async (options = {}) => createTiVoIndiaScraper().run(options)

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
