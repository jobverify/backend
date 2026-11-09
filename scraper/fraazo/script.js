import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FRAAZO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FRAAZO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const WWW_HOMEPAGE_URL = PROVIDER_METADATA.wwwHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WWW_CAREERS_URL = PROVIDER_METADATA.wwwCareerPageUrl
export const JOBS_URL = PROVIDER_METADATA.jobsUrl
export const WWW_JOBS_URL = PROVIDER_METADATA.wwwJobsUrl
export const ROBOTS_URL = PROVIDER_METADATA.robotsUrl
export const WWW_ROBOTS_URL = PROVIDER_METADATA.wwwRobotsUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const WWW_SITEMAP_URL = PROVIDER_METADATA.wwwSitemapUrl
export const TIMEOUT_PROBE_URLS = PROVIDER_METADATA.timeoutProbeUrls

export const HOMEPAGE_ROUTE_URLS = [
  HOMEPAGE_URL,
  WWW_HOMEPAGE_URL,
]

export const CAREERS_ROUTE_URLS = [
  CAREERS_URL,
  WWW_CAREERS_URL,
  'https://fraazo.com/career',
  'https://www.fraazo.com/career',
  JOBS_URL,
  WWW_JOBS_URL,
  'https://fraazo.com/join-us',
  'https://www.fraazo.com/join-us',
  'https://fraazo.com/openings',
  'https://www.fraazo.com/openings',
  'https://fraazo.com/work-with-us',
  'https://www.fraazo.com/work-with-us',
]

export const DISCOVERY_ROUTE_URLS = [
  ROBOTS_URL,
  WWW_ROBOTS_URL,
  SITEMAP_URL,
  WWW_SITEMAP_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    return url.toString()
  } catch {
    return String(value ?? '').trim()
  }
}

export const isVerifiedTimeoutResult = (result = {}, requestedUrl = '') => {
  if (result?.ok !== false) {
    return false
  }

  if (normalizeUrl(result?.url ?? requestedUrl) !== normalizeUrl(requestedUrl)) {
    return false
  }

  const errorName = String(result?.errorName ?? '')
  const errorMessage = String(result?.errorMessage ?? '')
  const causeName = String(result?.causeName ?? '')
  const causeMessage = String(result?.causeMessage ?? '')
  const combined = `${errorName} ${errorMessage} ${causeName} ${causeMessage}`.toLowerCase()

  return combined.includes('timeout') || combined.includes('aborted')
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const isVerifiedReachableNoJobsResult = (result = {}) => {
  if (result?.ok !== true || !Number.isInteger(result?.status)) return false

  const html = String(result?.html ?? '')
  const text = normalizeWhitespace(html)
  if (text === '') return true

  if (/^User-agent:\s*\*/i.test(text) && /\bSitemap:\s*\/sitemap\.xml/i.test(text)) {
    return !/\b(careers?|jobs?|openings?|join-us|work-with-us)\b/i.test(text)
  }

  if (/https:\/\/(?:www\.)?fraazo\.com\/lander/i.test(text)) {
    return !/\b(careers?|jobs?|openings?|join-us|work-with-us)\b/i.test(text)
  }

  return /<urlset\b/i.test(html)
    && /https:\/\/fraazo\.com\/lander/i.test(html)
    && !/\b(careers?|jobs?|openings?|join-us|work-with-us)\b/i.test(text)
}

const defaultFetchPage = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })

    return {
      ok: true,
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  } catch (error) {
    return {
      ok: false,
      url,
      errorName: error?.name ?? 'Error',
      errorMessage: error?.message ?? String(error),
      causeName: error?.cause?.constructor?.name ?? null,
      causeMessage: error?.cause?.message ?? null,
    }
  }
}

const assertTimeoutRoutes = (results, routeUrls, routeLabel) => {
  for (const routeUrl of routeUrls) {
    const result = results.get(routeUrl)

    if (!isVerifiedTimeoutResult(result, routeUrl) && !isVerifiedReachableNoJobsResult(result)) {
      throw new Error(`Fraazo ${routeLabel} changed materially or became reachable: ${routeUrl}`)
    }
  }
}

export const createFraazoScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const resultEntries = await Promise.all(
      TIMEOUT_PROBE_URLS.map(async (url) => [url, await fetchPage(url)]),
    )
    const results = new Map(resultEntries)

    assertTimeoutRoutes(results, HOMEPAGE_ROUTE_URLS, 'homepage route')
    assertTimeoutRoutes(results, CAREERS_ROUTE_URLS, 'careers route')
    assertTimeoutRoutes(results, DISCOVERY_ROUTE_URLS, 'discovery route')

    return []
  },
})

export const run = async (options = {}) => createFraazoScraper().run(options)

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
