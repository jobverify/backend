import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AUTHORSTREAM_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AUTHORSTREAM_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const LANDER_URL = PROVIDER_METADATA.landerUrl
export const CHECKED_ROUTE_URLS = PROVIDER_METADATA.checkedRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNREACHABLE_ERROR_PATTERN = /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed|aborted due to timeout|timeout/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  })

  return {
    status: response.status,
    url: response.url,
    location: response.headers.get('location'),
    html: response.status === 307 || response.status === 308 ? '' : await response.text(),
  }
}

export const isUnreachableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNREACHABLE_ERROR_PATTERN.test(message)
    || UNREACHABLE_ERROR_PATTERN.test(causeCode)
    || UNREACHABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchPageSafely = async (fetchPage, url) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (!isUnreachableError(error)) throw error

    return {
      status: null,
      url,
      location: null,
      html: null,
      errorKind: 'unreachable',
    }
  }
}

export const isUnavailableSurface = (page = {}) =>
  page?.status == null
  && page?.errorKind === 'unreachable'

export const extractRedirectTarget = (html = '') => {
  const match = /window\.location\.href\s*=\s*["']([^"']+)["']/i.exec(String(html ?? ''))
  return match?.[1] ?? null
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasRedirectShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<!DOCTYPE html>/i.test(rawHtml)
    && /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*;?\s*\}/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasExpectedRobotsTxtSignal = (text = '') => {
  const normalized = String(text ?? '')

  return /User-agent:\s*\*/i.test(normalized)
    && /Allow:\s*\/\s*$/im.test(normalized)
    && /LLM-Policy:\s*\/llms\.txt/i.test(normalized)
    && /Sitemap:\s*\/sitemap\.xml/i.test(normalized)
}

export const extractSitemapUrls = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) => match[1])

export const hasExpectedSitemapSignal = (xml = '') => {
  const urls = extractSitemapUrls(xml)
  return urls.length === 1 && urls[0] === LANDER_URL
}

export const hasParkedLanderRedirect = (response = {}) =>
  Number(response?.status) === 307
  && /^(https:\/\/www\.afternic\.com\/forsale\/authorstream\.com\b|https:\/\/forsale\.godaddy\.com\/forsale\/authorstream\.com\b)/i
    .test(String(response?.location ?? ''))

export const createAuthorStreamScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      if (homepage.status !== 200 || !hasRedirectShellSignal(homepage.html) || extractRedirectTarget(homepage.html) !== '/lander') {
        throw new Error('AuthorStream verified parked homepage no longer matches the known public surface')
      }

      if (hasPublicJobsSignal(homepage.html)) {
        throw new Error('AuthorStream homepage now appears to expose public jobs')
      }

      const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
      if (robotsTxt.status !== 200 || !hasExpectedRobotsTxtSignal(robotsTxt.html)) {
        throw new Error('AuthorStream verified robots.txt no longer matches the known public surface')
      }

      const sitemap = await fetchPage(SITEMAP_URL)
      if (sitemap.status !== 200 || !hasExpectedSitemapSignal(sitemap.html)) {
        throw new Error('AuthorStream verified sitemap no longer matches the known public surface')
      }

      for (const routeUrl of CHECKED_ROUTE_URLS) {
        const routePage = await fetchPage(routeUrl)

        if (routePage.status !== 200 || !hasRedirectShellSignal(routePage.html) || hasPublicJobsSignal(routePage.html)) {
          throw new Error(`AuthorStream verified no-public-careers route changed: ${routePage.url || routeUrl}`)
        }
      }

      const lander = await fetchPage(LANDER_URL)
      if (!hasParkedLanderRedirect(lander)) {
        throw new Error('AuthorStream parked-domain redirect changed or now exposes a public jobs surface')
      }

      return []
    } catch (error) {
      if (!isUnreachableError(error)) throw error

      const surfaces = await Promise.all([
        fetchPageSafely(fetchPage, HOMEPAGE_URL),
        fetchPageSafely(fetchPage, ROBOTS_TXT_URL),
        fetchPageSafely(fetchPage, SITEMAP_URL),
        fetchPageSafely(fetchPage, LANDER_URL),
        ...CHECKED_ROUTE_URLS.map((url) => fetchPageSafely(fetchPage, url)),
      ])

      if (surfaces.every(isUnavailableSurface)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createAuthorStreamScraper().run(options)

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
