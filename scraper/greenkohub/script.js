import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = 'Greenko Hub'
export const SOURCE = 'greenkohub'
export const DARWINBOX_COMPANY_ID = 'main'
export const DARWINBOX_ORIGIN = 'https://greenkogroup.darwinbox.in'
export const OFFICIAL_HOMEPAGE_URL = 'https://www.greenkogroup.com/'
export const PUBLIC_JOBS_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const OFFICIAL_FETCH_TIMEOUT_MS = 15000

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeOutputLocation = (value) => normalizeWhitespace(value)?.replace(/\s+,/g, ',') || null

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const extractOfficialPublicJobsUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/greenkogroup\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialGreenkoHubHomepageSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Greenko Group'
    && text.includes('India’s First Dispatchable Renewables Company')
    && text.includes('Making Green Sustainable')
    && text.includes('info@greenkogroup.com')
    && extractOfficialPublicJobsUrl(page) === PUBLIC_JOBS_URL
}

export const hasBlockedDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<base href="\/ms\/candidatev2\/">/i.test(page)
    && /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/i.test(page)
    && /<app-root><\/app-root>/i.test(page)
    && /db-components\.esm\.js/i.test(page)
}

export const hasMinimalDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Greenko Group'
    && text.endsWith('Greenko Group -')
    && text.includes('Greenko Group')
}

export const isBlockedDarwinboxListingsError = (error) =>
  /\bHTTP 403\b|Forbidden|Attention Required! \| Cloudflare|darwinbox-listings/i
    .test(String(error?.message ?? error ?? ''))

export const isGreenkoOfficialUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname === 'greenkogroup.com' || url.hostname === 'www.greenkogroup.com'
  } catch {
    return false
  }
}

export const isGreenkoCertificateVerificationError = (error) =>
  /\bunable to verify the first certificate\b|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY|SELF_SIGNED_CERT_IN_CHAIN/i
    .test([
      error?.message,
      error?.cause?.message,
      error?.code,
    ].filter(Boolean).join(' | '))

// Caller cancellation is opaque and must settle even when an injected read
// ignores its signal. This adds no timeout, retry, or inventory authority.
export const withGreenkoCallerCancellation = async (signal, operation) => {
  signal?.throwIfAborted()
  if (!signal) return operation()
  let onAbort
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    const value = await Promise.race([
      Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }),
      aborted,
    ])
    signal.throwIfAborted()
    return value
  } catch (error) {
    if (signal.aborted) throw signal.reason
    throw error
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

export const fetchOfficialGreenkoTextWithoutTlsVerification = (
  url,
  {
    headers = {},
    timeoutMs = OFFICIAL_FETCH_TIMEOUT_MS,
    signal,
  } = {},
) => withGreenkoCallerCancellation(signal, () => new Promise((resolve, reject) => {
  const request = https.request(url, {
    method: 'GET',
    headers,
    rejectUnauthorized: true,
    ...(signal ? { signal } : {}),
  }, (response) => {
    let body = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      body += chunk
    })
    response.on('end', () => {
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`))
        return
      }
      resolve(body)
    })
  })

  request.setTimeout(timeoutMs, () => {
    request.destroy(new Error(`Request timed out after ${timeoutMs}ms for ${url}`))
  })
  request.on('error', reject)
  request.end()
}))

export const fetchOfficialGreenkoText = async (
  url,
  {
    headers = {},
    label = 'greenkohub-official',
    signal,
    timeoutMs = OFFICIAL_FETCH_TIMEOUT_MS,
    fetchTextWithRetryImpl = fetchTextWithRetry,
    insecureHtmlFetch = fetchOfficialGreenkoTextWithoutTlsVerification,
  } = {},
) => withGreenkoCallerCancellation(signal, async () => {
  try {
    return await fetchTextWithRetryImpl(url, {
      headers,
      label,
      timeoutMs,
      ...(signal ? { signal } : {}),
    })
  } catch (error) {
    signal?.throwIfAborted()
    if (!isGreenkoOfficialUrl(url) || !isGreenkoCertificateVerificationError(error)) {
      throw error
    }

    return insecureHtmlFetch(url, {
      headers,
      timeoutMs,
      ...(signal ? { signal } : {}),
    })
  }
})

const defaultFetchText = (url, { signal } = {}) => fetchOfficialGreenkoText(url, {
  ...(signal ? { signal } : {}),
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'greenkohub-official',
  timeoutMs: OFFICIAL_FETCH_TIMEOUT_MS,
})

export const createGreenkoHubScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
    fetchJobDetail,
    signal,
  } = {}) {
    return withGreenkoCallerCancellation(signal, async () => {
      const homepageHtml = await fetchText(OFFICIAL_HOMEPAGE_URL, { signal })
      signal?.throwIfAborted()

      if (!hasOfficialGreenkoHubHomepageSignals(homepageHtml)) {
        throw new Error('Greenko Hub verified official homepage no longer matches the verified public jobs surface')
      }

      const jobs = await darwinboxScraper.run({
        maxPages,
        maxJobs,
        fetchListingPage,
        fetchJobDetail,
        signal,
      })
      signal?.throwIfAborted()

      const scrapedAt = now()

      return mapJobsWithInventoryEvidence(jobs, (job) => ({
        ...job,
        location: normalizeOutputLocation(job.location),
        scrapedAt,
      }))
    })
  },
})

export const run = async (options = {}) => createGreenkoHubScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Greenko Hub scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log('Dry run - wrote jobs to jobs.json')
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
