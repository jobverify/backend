import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GROW_SIMPLEE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i
const TLS_ERROR_PATTERN = /tls|ssl|certificate|cert|trust relationship/i
const DNS_ERROR_PATTERN = /enotfound|eai_again|getaddrinfo|dns/i
const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(careers?|jobs?|current openings|open positions|apply now|search jobs|join our team)\b/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const TRUSTED_API_DOCS_URL = PROVIDER_METADATA.trustedApiDocsUrl
export const TECHNICAL_CONTACT_EMAIL = PROVIDER_METADATA.technicalContactEmail
export const ROUTE_EXPECTATIONS = PROVIDER_METADATA.firstPartyRouteExpectations.map((item) => ({ ...item }))

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true

  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(causeCode)
    || TIMEOUT_ERROR_PATTERN.test(causeMessage)
    || TIMEOUT_ERROR_PATTERN.test(message)
}

const isTlsError = (error) => {
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /CERT|SSL|TLS/i.test(causeCode)
    || TLS_ERROR_PATTERN.test(causeMessage)
    || TLS_ERROR_PATTERN.test(message)
}

const isDnsError = (error) => {
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /ENOTFOUND|EAI_AGAIN/i.test(causeCode)
    || DNS_ERROR_PATTERN.test(causeMessage)
    || DNS_ERROR_PATTERN.test(message)
}

export const hasVerifiedApiDocsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Blitz External APIs\s*<\/title>/i.test(page)
    && text.includes('Blitz External APIs')
}

export const isExpectedUnavailableSurface = (surface = {}, expectedErrorKind) =>
  (
    surface?.errorKind === expectedErrorKind
    || surface?.errorKind === 'network'
    || (expectedErrorKind === 'tls' && surface?.errorKind === 'dns')
  )
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const isUnexpectedReachableSurface = (surface = {}) =>
  isReachableSurface(surface) && PUBLIC_JOBS_SIGNAL_PATTERN.test(normalizeWhitespace(surface?.html))

const defaultFetchPage = async (url) => {
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
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
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

    if (isTimeoutError(error)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'timeout',
      }
    }

    if (isTlsError(error)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'tls',
      }
    }

    if (isDnsError(error)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
      }
    }

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const createGrowSimpleeScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    probeUrl = defaultProbeUrl,
  } = {}) {
    const docsPage = await fetchPage(TRUSTED_API_DOCS_URL)

    if (docsPage?.status !== 200 || !hasVerifiedApiDocsSignal(docsPage?.html)) {
      throw new Error('GrowSimplee verified api docs surface no longer matches trusted first-party evidence')
    }

    for (const expectation of ROUTE_EXPECTATIONS) {
      const surface = await probeUrl(expectation.url)

      if (isExpectedUnavailableSurface(surface, expectation.errorKind)) continue

      if (isUnexpectedReachableSurface(surface)) {
        throw new Error(
          `${COMPANY} public jobs surface now appears reachable: ${surface.finalUrl || surface.url || expectation.url}`,
        )
      }

      if (isReachableSurface(surface)) {
        throw new Error(
          `${COMPANY} verified first-party route state changed materially: ${surface.finalUrl || surface.url || expectation.url}`,
        )
      }

      throw new Error(
        `${COMPANY} verified first-party route state changed materially: ${surface.url || expectation.url}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createGrowSimpleeScraper().run(options)

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
