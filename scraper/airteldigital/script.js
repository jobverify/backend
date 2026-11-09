import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { AIRTEL_DIGITAL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AIRTEL_DIGITAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SHARED_DARWINBOX_URL = PROVIDER_METADATA.sharedDarwinboxUrl
export const SHARED_CAREERS_API_URL = PROVIDER_METADATA.sharedCareersApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const extractMainBundleUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/static\/js\/main\.[^"']+\.js)["']/i,
  )

  return toAbsoluteUrl(match?.[1], CAREERS_URL)
}

export const hasOfficialCareersShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Airtel Careers\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Airtel Careers["']/i.test(page)
    && /<noscript>\s*You need to enable JavaScript to run this app\.\s*<\/noscript>/i.test(page)
    && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(page)
    && extractMainBundleUrl(page) !== null
}

export const hasDistinctAirtelDigitalSignal = (value = '') =>
  /airtel[\s-]?digital/i.test(String(value ?? ''))

export const hasVerifiedBundleSignal = (bundleText = '') => {
  const bundle = String(bundleText ?? '')

  return !hasDistinctAirtelDigitalSignal(bundle)
    && /"darwinboxURL":"https:\/\/airtel\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs"/i.test(bundle)
    && /"apiUrl":"https:\/\/careersapi\.airtel\.com\/"/i.test(bundle)
}

export const hasSharedDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<base href="\/ms\/candidatev2\/">/i.test(page)
    && /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/i.test(page)
    && /db-components\.esm\.js/i.test(page)
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout/i
    .test(String(error?.message ?? error ?? ''))

export const createAirtelDigitalScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText, signal } = {}) {
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

    const browserTextFetcher = fetchBrowserText || (async (url, options = {}) => {
      const session = await getBrowserSession()
      return session.fetchText(url, { ...options, signal })
    })

    const readBrowser = async url => {
      signal?.throwIfAborted()
      try {
        const value = await browserTextFetcher(url, { signal })
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const fetchPageText = async (url) => {
      signal?.throwIfAborted()
      let value
      try {
        value = await fetchText(url, { signal })
        signal?.throwIfAborted()
      } catch (error) {
        signal?.throwIfAborted()
        if (!isBrowserFallbackError(error)) throw error
        return readBrowser(url)
      }

      return value
    }

    try {
      const careersHtml = await fetchPageText(CAREERS_URL)

      if (!hasOfficialCareersShellSignal(careersHtml)) {
        throw new Error('Airtel Digital verified first-party Airtel careers shell no longer matches the shared public surface')
      }

      const bundleUrl = extractMainBundleUrl(careersHtml)
      const bundleText = await fetchPageText(bundleUrl)

      if (hasDistinctAirtelDigitalSignal(bundleText)) {
        throw new Error('Airtel Digital now appears to have a distinct Airtel Digital public surface and needs a dedicated scraper')
      }

      if (!hasVerifiedBundleSignal(bundleText)) {
        throw new Error('Airtel Digital verified Airtel careers bundle no longer matches the shared public surface')
      }

      const darwinboxShellHtml = await fetchPageText(SHARED_DARWINBOX_URL)

      if (!hasSharedDarwinboxShellSignal(darwinboxShellHtml)) {
        throw new Error('Airtel Digital verified shared Darwinbox shell no longer matches the public surface')
      }

      return []
    } finally {
      try {
        if (browserSession) await browserSession.close()
      } finally { signal?.throwIfAborted() }
    }
  },
})

export const run = async (options = {}) => createAirtelDigitalScraper().run(options)

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
