import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STOCKGRO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const TRUSTED_PUBLIC_JOB_PATTERNS = [
  /https?:\/\/[^\s"'<>]+boards\.greenhouse\.io[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+job-boards\.greenhouse\.io[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+jobs\.lever\.co[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+(?:myworkdayjobs|workdayjobs)[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+smartrecruiters[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+ashbyhq\.com[^\s"'<>]*/gi,
  /https?:\/\/[^\s"'<>]+workable\.com[^\s"'<>]*/gi,
]

export const PROVIDER_METADATA = STOCKGRO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_OPERATING_ENTITY = PROVIDER_METADATA.officialOperatingEntity

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '/')

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

export const extractOperatingEntity = (html = '') =>
  normalizeWhitespace(String(html ?? '')).match(/\bAssetgro Fintech Private Limited\b/i)?.[0] ?? null

export const extractTrustedPublicJobLinks = (html = '') => {
  const page = String(html ?? '')
  const links = new Set()

  for (const pattern of TRUSTED_PUBLIC_JOB_PATTERNS) {
    for (const match of page.matchAll(pattern)) {
      links.add(match[0])
    }
  }

  return [...links]
}

export const pageExposesPublicJobListings = (html = '') =>
  /"@type"\s*:\s*"JobPosting"/i.test(String(html ?? ''))
  || extractTrustedPublicJobLinks(html).length > 0

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers - easiest way to master trading &amp; investments\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.stockgro\.club\/careers\/["']/i.test(page)
    && normalized.includes('Explore our current job openings and join us!')
    && extractOperatingEntity(page) === OFFICIAL_OPERATING_ENTITY
  }

export const createStockGroScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (Number(careersPage.status) !== 200 || !matchesExpectedUrl(careersPage.url, CAREERS_URL)) {
      throw new Error('StockGro verified careers page changed materially')
    }

    if (pageExposesPublicJobListings(careersPage.html)) {
      throw new Error('StockGro careers page now appears to expose a public jobs surface')
    }

    if (
      !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('StockGro verified careers page changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createStockGroScraper().run(options)

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
