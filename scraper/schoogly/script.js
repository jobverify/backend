import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SCHOOGLY_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /\btimeout\b|\btimed out\b|\bund_err_connect_timeout\b|\betimedout\b/i
const DNS_ERROR_PATTERN = /\bcould not resolve host\b|\bgetaddrinfo\b|\benotfound\b|\beai_again\b|\bnxdomain\b/i
const TLS_ERROR_PATTERN = /\bissuer certificate\b|\bself[- ]signed\b|\bcertificate\b/i
const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(careers?|jobs?|current openings|open positions|apply now|search jobs|join our team)\b/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const FIRST_PARTY_TIMEOUT_URLS = [...PROVIDER_METADATA.firstPartyTimeoutUrls]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const isExpectedTlsFailureSurface = (surface = {}) =>
  surface?.errorKind === 'tls'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const isUnexpectedReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status)
  && surface.status > 0
  && PUBLIC_JOBS_SIGNAL_PATTERN.test(normalizeWhitespace(surface?.html))

export const isExpectedRedirectOnlySurface = (surface = {}) =>
  Number(surface?.status) === 200
  && /^Redirecting\.\.\.$/i.test(normalizeWhitespace(surface?.html))

export const isExpectedVerificationFailure = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')

  return TIMEOUT_ERROR_PATTERN.test(message)
    || TIMEOUT_ERROR_PATTERN.test(causeMessage)
    || TIMEOUT_ERROR_PATTERN.test(causeCode)
}

const classifyErrorKind = (error) => {
  if (!error) return 'network'

  if (error?.name === 'AbortError'
    || TIMEOUT_ERROR_PATTERN.test(String(error?.message ?? ''))
    || TIMEOUT_ERROR_PATTERN.test(String(error?.cause?.message ?? ''))
    || TIMEOUT_ERROR_PATTERN.test(String(error?.cause?.code ?? ''))
  ) {
    return 'timeout'
  }

  if (DNS_ERROR_PATTERN.test(String(error?.message ?? ''))
    || DNS_ERROR_PATTERN.test(String(error?.cause?.message ?? ''))
    || DNS_ERROR_PATTERN.test(String(error?.cause?.code ?? ''))
  ) {
    return 'dns'
  }

  if (TLS_ERROR_PATTERN.test(String(error?.message ?? ''))
    || TLS_ERROR_PATTERN.test(String(error?.cause?.message ?? ''))
    || TLS_ERROR_PATTERN.test(String(error?.cause?.code ?? ''))
  ) {
    return 'tls'
  }

  return 'network'
}

const defaultProbeUrl = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: classifyErrorKind(error),
      errorMessage: String(error?.message ?? error),
    }
  }
}

const isReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const createSchooglyScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    for (const url of FIRST_PARTY_TIMEOUT_URLS) {
      const surface = await probeUrl(url)

      if (isExpectedTimedOutSurface(surface) || isExpectedTlsFailureSurface(surface) || isExpectedRedirectOnlySurface(surface)) continue

      if (isUnexpectedReachableSurface(surface)) {
        throw new Error(`${COMPANY} public jobs surface now appears reachable: ${surface.finalUrl || surface.url}`)
      }

      if (isReachableSurface(surface)) {
        throw new Error(`${COMPANY} first-party candidate surface now appears reachable and requires re-verification: ${surface.finalUrl || surface.url}`)
      }

      throw new Error(`${COMPANY} verified timed-out surface changed materially: ${surface.finalUrl || surface.url}`)
    }

    return []
  },
})

export const run = async (options = {}) => createSchooglyScraper().run(options)

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
