import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FINCARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FINCARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LEGACY_WWW_HOMEPAGE_URL = PROVIDER_METADATA.legacyWwwHomepageUrl
export const MERGED_PARENT_HOMEPAGE_URL = PROVIDER_METADATA.mergedParentHomepageUrl
export const LEGACY_MERGER_INFO_URL = PROVIDER_METADATA.legacyMergerInfoUrl
export const CHECKED_REDIRECT_ROUTE_URLS = [...PROVIDER_METADATA.checkedRedirectRouteUrls]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return null
  }
}

const isLegacyRouteFetchFailure = (error) => {
  const code = String(error?.code || error?.cause?.code || '').trim().toUpperCase()
  const message = String(error?.message || error?.cause?.message || '').trim()

  return ['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'].includes(code)
    || /getaddrinfo ENOTFOUND|timed out|timeout|ECONNRESET|ECONNREFUSED/i.test(message)
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

export const hasMergedParentHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Personal, Business, Corporate, and NRI Banking \| AU Small Finance Bank\s*<\/title>/i.test(rawHtml)
    && /\bAU Small Finance Bank\b/i.test(normalized)
    && /\bPersonal, Business, Corporate, and NRI Banking\b/i.test(normalized)
    && /\bFincare NetBanking\b/i.test(normalized)
    && /\bFincare Corporate NetBanking\b/i.test(normalized)
}

export const hasCloudflareChallengePageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(rawHtml)
    && /\bEnable JavaScript and cookies to continue\b/i.test(normalized)
}

export const hasMergedParentHomepageCloudflareSignal = hasCloudflareChallengePageSignal

export const isVerifiedMergedParentHomepage = (page = {}) =>
  normalizeUrl(page.url) === normalizeUrl(MERGED_PARENT_HOMEPAGE_URL)
  && (
    (
      Number(page.status) === 200
      && hasMergedParentHomepageSignal(page.html)
    )
    || (
      Number(page.status) === 403
      && hasCloudflareChallengePageSignal(page.html)
    )
  )

export const isVerifiedLegacyRedirect = (page = {}) =>
  normalizeUrl(page.url) === normalizeUrl(MERGED_PARENT_HOMEPAGE_URL)
  && isVerifiedMergedParentHomepage(page)

export const createFincareScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const mergedParentHomepage = await fetchPage(MERGED_PARENT_HOMEPAGE_URL)

    if (!isVerifiedMergedParentHomepage(mergedParentHomepage)) {
      throw new Error('Fincare verified merged AU homepage no longer matches the pinned public surface')
    }

    for (const routeUrl of CHECKED_REDIRECT_ROUTE_URLS) {
      let page
      try {
        page = await fetchPage(routeUrl)
      } catch (error) {
        if (isLegacyRouteFetchFailure(error)) {
          continue
        }
        throw error
      }

      if (!isVerifiedLegacyRedirect(page)) {
        throw new Error(`Fincare verified exact-name route changed: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createFincareScraper().run(options)

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
