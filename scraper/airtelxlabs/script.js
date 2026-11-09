import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { AIRTEL_X_LABS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AIRTEL_X_LABS_CATALOG.source
export const COMPANY = AIRTEL_X_LABS_CATALOG.companyName
export const BRANDED_HOMEPAGE_URL = AIRTEL_X_LABS_CATALOG.brandedHomepageUrl
export const CAREERS_HANDOFF_URL = AIRTEL_X_LABS_CATALOG.companyCareerPage
export const GENERIC_AIRTEL_CAREERS_URL = AIRTEL_X_LABS_CATALOG.parentCareersPage
export const VERIFIED_SURFACE_SUMMARY = AIRTEL_X_LABS_CATALOG.verifiedSurfaceSummary
export const NO_PUBLIC_BRANDED_ROUTE_URLS = [
  'https://www.airtelxlabs.com/careers',
  'https://www.airtelxlabs.com/jobs',
]
export const GENERIC_XLABS_ROUTE_URLS = [
  'https://www.airtel.in/careers/airtelxlabs/jobs',
  'https://www.airtel.in/careers/airtelxlabs/openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })
  signal?.throwIfAborted()

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const shouldUseBrowserFallback = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout/i
    .test(String(error?.message ?? error ?? ''))

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const hasBrandedHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*airtelxlabs\s*<\/title>/i.test(rawHtml)
    && /<frameset/i.test(rawHtml)
    && /<frame[^>]+src=["']https:\/\/www\.airtel\.in\/careers\/airtelxlabs\/["']/i.test(rawHtml)
    && /\bairtelxlabs\b/i.test(normalized)
}

export const hasGenericAirtelCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const isFullAirtelCareersShell = /careers at airtel/i.test(normalized)
    && /careersapi\.airtel\.com/i.test(rawHtml)
    && /airtel\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i.test(rawHtml)
  const isMinimalAirtelCareersShell = /You need to enable JavaScript to run this app\./i.test(normalized)

  return /<title>\s*Airtel Careers\s*<\/title>/i.test(rawHtml)
    && (isFullAirtelCareersShell || isMinimalAirtelCareersShell)
    && !/\bAirtel X Labs\b/i.test(rawHtml)
    && !/\bairtelxlabs\b/i.test(rawHtml)
}

export const isMissingBrandedCareerRoute = (page) => Number(page?.status) === 404

const isGenericAirtelCareersHandoff = (page, fallbackUrl) =>
  page?.status === 200
  && getFinalUrl(page, fallbackUrl) === GENERIC_AIRTEL_CAREERS_URL
  && hasGenericAirtelCareersSignal(page?.html)

export const createAirtelXLabsScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchBrowserPage, signal } = {}) {
    signal?.throwIfAborted()
    let browserSession = null

    const getBrowserSession = async () => {
      signal?.throwIfAborted()
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT, signal })
      }

      signal?.throwIfAborted()
      return browserSession
    }

    const browserPageFetcher = fetchBrowserPage || (async (url, options = {}) => {
      const session = await getBrowserSession()
      return session.fetchPage(url, { ...options, signal })
    })

    const readBrowser = async url => {
      signal?.throwIfAborted()
      try {
        const value = await browserPageFetcher(url, { signal })
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const fetchVerifiedPage = async (url) => {
      signal?.throwIfAborted()
      let value
      try {
        value = await fetchPage(url, { signal })
        signal?.throwIfAborted()
      } catch (error) {
        signal?.throwIfAborted()
        if (!shouldUseBrowserFallback(error)) throw error
        return readBrowser(url)
      }
      if ([403, 429].includes(Number(value?.status))) return readBrowser(url)
      return value
    }

    try {
      const brandedHomepage = await fetchVerifiedPage(BRANDED_HOMEPAGE_URL)
      if (brandedHomepage.status !== 200 || !hasBrandedHomepageSignal(brandedHomepage.html)) {
        throw new Error('Airtel X Labs verified branded homepage no longer matches the known public surface')
      }

      const careersHandoff = await fetchVerifiedPage(CAREERS_HANDOFF_URL)
      if (!isGenericAirtelCareersHandoff(careersHandoff, CAREERS_HANDOFF_URL)) {
        throw new Error('Airtel X Labs verified Airtel careers handoff no longer matches the known public surface')
      }

      for (const routeUrl of NO_PUBLIC_BRANDED_ROUTE_URLS) {
        const routePage = await fetchVerifiedPage(routeUrl)
        if (!isMissingBrandedCareerRoute(routePage)) {
          throw new Error(`Airtel X Labs verified missing branded route changed: ${routePage.url || routeUrl}`)
        }
      }

      for (const routeUrl of GENERIC_XLABS_ROUTE_URLS) {
        const routePage = await fetchVerifiedPage(routeUrl)
        if (!isGenericAirtelCareersHandoff(routePage, routeUrl)) {
          throw new Error('Airtel X Labs verified generic Airtel x-labs route no longer matches the known public surface')
        }
      }

      return []
    } finally {
      try {
        if (browserSession) await browserSession.close()
      } finally { signal?.throwIfAborted() }
    }
  },
})

export const run = async (options = {}) => createAirtelXLabsScraper().run(options)

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
