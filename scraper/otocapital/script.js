import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { OTO_CAPITAL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = OTO_CAPITAL_CATALOG.source
export const COMPANY = OTO_CAPITAL_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = OTO_CAPITAL_CATALOG.officialBrandName
export const VERIFIED_ON = OTO_CAPITAL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = OTO_CAPITAL_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = OTO_CAPITAL_CATALOG.homepageUrl
export const SITEMAP_URL = OTO_CAPITAL_CATALOG.officialSitemapUrl
export const CAREERS_URL = OTO_CAPITAL_CATALOG.companyCareerPage
export const JOBS_URL = OTO_CAPITAL_CATALOG.officialJobsPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards(?:\.eu)?\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /\bjob id\b/i,
  /\brequisition\b/i,
  /\bapply now\b/i,
]

const EXPECTED_SITEMAP_ROUTES = [
  'https://www.otocapital.in/',
  'https://www.otocapital.in/grievance-portal',
  'https://www.otocapital.in/lending-partners',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&#x27;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '') || null

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = extractTitle(page)

  return title === 'Buy Bikes, Scooters, Electric Scooters In India - OTO'
    && /India's No 1 platform for Bike & Scooter Loans/i.test(normalized)
    && /FREQUENTLY ASKED QUESTIONS/i.test(normalized)
    && /What is OTO\?/i.test(normalized)
    && /OTO Capital also provides/i.test(normalized)
    && /22\+ cities across India/i.test(normalized)
}

const extractSitemapLocs = (xml) =>
  Array.from(String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi), (match) => match[1].trim())

export const sitemapHasPublicCareersRoute = (xml) =>
  extractSitemapLocs(xml).some((loc) => {
    try {
      const pathname = new URL(loc).pathname
      return /^\/(careers?|jobs?|join-us)\/?$/i.test(pathname)
    } catch {
      return false
    }
  })

const sitemapIncludesExpectedCoreRoutes = (xml) => {
  const locs = new Set(extractSitemapLocs(xml).map((loc) => normalizeUrl(loc)))
  return EXPECTED_SITEMAP_ROUTES.every((loc) => locs.has(normalizeUrl(loc)))
}

export const hasVerifiedNotFoundSignal = (html) => {
  const title = extractTitle(html)
  const normalized = normalizeWhitespace(html)

  return title === 'OTO Capital - Not Found'
    && /Visit OTO Capital/i.test(normalized)
    && /Explore new bikes/i.test(normalized)
    && /Explore bike plans/i.test(normalized)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createOtoCapitalScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('OTO Capital verified homepage no longer matches the official first-party surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !sitemapIncludesExpectedCoreRoutes(sitemap.html)) {
      throw new Error('OTO Capital verified sitemap no longer matches the official first-party surface')
    }
    if (sitemapHasPublicCareersRoute(sitemap.html)) {
      throw new Error('OTO Capital verified sitemap now exposes a public careers route')
    }

    for (const url of [CAREERS_URL, JOBS_URL]) {
      const response = await fetchPage(url)

      if (hasPublicJobsSignal(response.html)) {
        throw new Error('OTO Capital official careers surface now appears to expose public jobs')
      }

      if (response.status !== 404 || !hasVerifiedNotFoundSignal(response.html)) {
        throw new Error('OTO Capital verified careers routes no longer match the official first-party not-found contract')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createOtoCapitalScraper().run(options)

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
