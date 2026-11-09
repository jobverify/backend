import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ENMOVIL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ENMOVIL_CATALOG.source
export const COMPANY = ENMOVIL_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ENMOVIL_CATALOG.officialBrandName
export const HOMEPAGE_URL = ENMOVIL_CATALOG.homepageUrl
export const CAREERS_URL = ENMOVIL_CATALOG.companyCareerPage
export const SITEMAP_URL = ENMOVIL_CATALOG.sitemapUrl
export const JOBS_URL = ENMOVIL_CATALOG.checkedJobsRouteUrl
export const COUNTRY_FILTER = ENMOVIL_CATALOG.countryFilter
export const VERIFIED_ON = ENMOVIL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ENMOVIL_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ENMOVIL_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bapply now\b/i,
  /ashbyhq|greenhouse|lever|myworkdayjobs|workdayjobs|darwinbox|smartrecruiters|jobvite|recruitee|freshteam|breezy\.hr|wellfound/i,
  /href=["'][^"']*\/apply(?:\/|["'])/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

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

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const lowered = normalized.toLowerCase()

  return normalized.includes('AI Supply Chain & Logistics Intelligence Platform | Enmovil')
    && normalized.includes('CADDIE')
    && lowered.includes('erp')
    && lowered.includes('tms')
    && lowered.includes('book a demo')
}

export const extractSitemapUrls = (xml) => [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
  .map((match) => match[1].trim())

export const sitemapIncludesCareersUrl = (xml) =>
  extractSitemapUrls(xml).some((url) => sameUrl(url, CAREERS_URL))

export const sitemapIncludesHomepageUrl = (xml) =>
  extractSitemapUrls(xml).some((url) => sameUrl(url, HOMEPAGE_URL))

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return normalized.includes('Careers at Enmovil | Enmovil')
    && normalized.includes('Careers')
    && /rel=["']canonical["'][^>]+href=["']https:\/\/www\.enmovil\.ai\/careers["']/i.test(rawHtml)
}

export const hasVerifiedEmptyCareersState = (html) => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Careers') && /\bno open roles right now\b/i.test(normalized)
}

export const pageExposesPublicJobListings = (html) => {
  const rawHtml = String(html ?? '')
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(rawHtml))
}

export const isVerifiedMissingJobsRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page.html)

  return Number(page.status) === 404
    && normalized.includes('Page Not Found | Enmovil')
    && normalized.includes('404')
    && normalized.includes('Page Not Found')
    && !pageExposesPublicJobListings(page.html)
}

export const createEnmovilScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Enmovil homepage no longer matches the verified official homepage surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (
      sitemap.status !== 200
      || !sameUrl(sitemap.url, SITEMAP_URL)
      || !sitemapIncludesHomepageUrl(sitemap.html)
    ) {
      throw new Error('Enmovil sitemap no longer matches the verified official homepage URL contract')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Enmovil careers page changed materially or no longer matches the verified first-party careers shell')
    }

    if (pageExposesPublicJobListings(careersPage.html) || !hasVerifiedEmptyCareersState(careersPage.html)) {
      throw new Error('Enmovil careers page changed materially or now exposes a public jobs surface')
    }

    const jobsRoute = await fetchPage(JOBS_URL)
    if (!isVerifiedMissingJobsRoute(jobsRoute)) {
      throw new Error('Enmovil jobs route changed materially or now exposes a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createEnmovilScraper().run(options)

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
