import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { INDMONEY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INDMONEY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const LINKEDIN_JOBS_URL = PROVIDER_METADATA.linkedinJobsUrl
export const FIRST_PARTY_BLOCKED_URLS = [HOMEPAGE_URL, ABOUT_PAGE_URL]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const BROWSER_SETTLE_TIME_MS = 12000
const NETWORK_FALLBACK_ERROR_PATTERN =
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
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
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

const toAbsoluteUrl = (value, baseUrl = ABOUT_PAGE_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'indmoney.com' || hostname === 'www.indmoney.com'
  } catch {
    return false
  }
}

const normalizeLinkedInJobsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, ABOUT_PAGE_URL)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== 'linkedin.com' && hostname !== 'in.linkedin.com') return null

    if (/^\/company\/indmoney\/jobs\/?$/i.test(url.pathname)) {
      return LINKEDIN_JOBS_URL
    }

    if (/^\/company\/indmoney\/?$/i.test(url.pathname)) {
      return LINKEDIN_JOBS_URL
    }

    if (/^\/authwall\/?$/i.test(url.pathname)) {
      const redirected = url.searchParams.get('sessionRedirect')
      return redirected ? normalizeLinkedInJobsUrl(redirected) : null
    }
  } catch {
    return null
  }

  return null
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

export const hasCloudflareChallengePageSignal = (html = '') => {
  const source = String(html ?? '')
  const normalized = normalizeWhitespace(source)?.toLowerCase() || ''

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(source)
    && normalized.includes('enable javascript and cookies to continue')
    && (
      normalized.includes('security verification')
      || normalized.includes('cloudflare')
      || /\bindmoney\.com\b/i.test(source)
    )
}

export const isVerifiedBlockedFirstPartySurface = (page = {}) =>
  isOfficialDomainUrl(page.url || ABOUT_PAGE_URL)
  && [200, 403].includes(Number(page.status))
  && hasCloudflareChallengePageSignal(page.html)

const shouldUseBrowserFallback = (page = {}) => (
  page.status === 403 || page.status === 200
) && hasCloudflareChallengePageSignal(page.html)

const shouldUseBrowserFallbackForError = (error) =>
  NETWORK_FALLBACK_ERROR_PATTERN.test(String(error?.message ?? error ?? ''))

export const hasOfficialAboutPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Our Company')
    && normalized.includes('India’s independent Super Finance App')
    && normalized.includes('Join Us')
    && normalized.includes('Join Our Team')
    && normalized.includes('INDmoney Tech Pvt. Ltd.')
    && normalized.includes('All Rights Reserved | © Copyright 2026')
}

export const extractLinkedInJobsUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const normalizedUrl = normalizeLinkedInJobsUrl(match[1])
    if (normalizedUrl) return normalizedUrl
  }

  return null
}

export const hasFirstPartyPublicJobsSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  if (/"@type"\s*:\s*"JobPosting"/i.test(rawHtml) || /\bJobPosting\b/i.test(rawHtml)) {
    return true
  }

  for (const match of rawHtml.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], ABOUT_PAGE_URL)
    if (!absoluteUrl || !isOfficialDomainUrl(absoluteUrl)) continue

    try {
      const pathname = new URL(absoluteUrl).pathname.replace(/\/+$/, '/') || '/'
      if (/^\/(?:careers?|jobs?|join-us|openings)(?:\/|$)/i.test(pathname)) {
        return true
      }
    } catch {
      // Ignore malformed URLs and continue fail-closed through the other validators.
    }
  }

  return false
}

export const createIndmoneyScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchBrowserPage } = {}) {
    let browserSession = null
    const browserPageFetcher = fetchBrowserPage || (async (url) => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({
          userAgent: USER_AGENT,
          settleTimeMs: BROWSER_SETTLE_TIME_MS,
        })
      }

      return browserSession.fetchPage(url)
    })

    try {
      let aboutPage
      try {
        aboutPage = await fetchPage(ABOUT_PAGE_URL)
      } catch (error) {
        if (!shouldUseBrowserFallbackForError(error)) {
          throw error
        }

        aboutPage = await browserPageFetcher(ABOUT_PAGE_URL)
      }

      if (shouldUseBrowserFallback(aboutPage)) {
        aboutPage = await browserPageFetcher(ABOUT_PAGE_URL)
      }

      if (isVerifiedBlockedFirstPartySurface(aboutPage)) {
        const homepage = await fetchPage(HOMEPAGE_URL)

        if (isVerifiedBlockedFirstPartySurface(homepage)) {
          return []
        }

        throw new Error('INDmoney verified first-party Cloudflare block surface changed')
      }

      if (
        aboutPage.status !== 200
        || normalizeComparableUrl(aboutPage.url) !== normalizeComparableUrl(ABOUT_PAGE_URL)
      ) {
        throw new Error('INDmoney verified about page no longer matches the known first-party surface')
      }

      if (hasFirstPartyPublicJobsSignal(aboutPage.html)) {
        throw new Error('INDmoney about page now appears to expose a first-party public jobs surface')
      }

      if (!hasOfficialAboutPageSignal(aboutPage.html)) {
        throw new Error('INDmoney verified about page no longer matches the known first-party surface')
      }

      if (extractLinkedInJobsUrl(aboutPage.html) !== LINKEDIN_JOBS_URL) {
        throw new Error('INDmoney verified LinkedIn handoff changed')
      }

      return []
    } finally {
      if (browserSession) {
        await browserSession.close().catch(() => {})
      }
    }
  },
})

export const run = async (options = {}) => createIndmoneyScraper().run(options)

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
