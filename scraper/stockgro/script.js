import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STOCKGRO_CATALOG } from './catalog.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

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

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal,
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
  const document = readNativeDocument(page)
  const titles = activeHead(page).titles
  const canonicals = document.nodes(node => node.tag === 'link' && !node.inert
    && String(node.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'))
  const reviewedTitles = ['Careers - easiest way to master trading & investments',
    'Careers at StockGro: Explore Open Roles & Apply']

  return titles.length === 1 && reviewedTitles.includes(titles[0])
    && canonicals.length === 1 && canonicals[0].attrs.href === CAREERS_URL
    && !document.nodes(node => node.tag === 'base' && !node.inert).length
    && normalized.includes('Explore our current job openings and join us!')
    && extractOperatingEntity(page) === OFFICIAL_OPERATING_ENTITY
  }

export const createStockGroScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    let careersPage
    try { careersPage = await fetchPage(CAREERS_URL, { signal }) }
    catch (error) { signal?.throwIfAborted(); throw error }
    signal?.throwIfAborted()

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

    const jobs = attachInventoryEvidence([], {
      status: 'coverage-gap', surface: CAREERS_URL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: 1,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: 'current-own-publisher-careers-intake-without-verified-native-role-inventory;whole-company-totals-and-cleanup-unqualified',
    })
    signal?.throwIfAborted()
    return jobs
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
