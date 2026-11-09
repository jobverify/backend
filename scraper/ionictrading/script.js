import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { IONIC_TRADING_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i
const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(careers?|jobs?|current openings|open positions|apply now|search jobs|job openings)\b/i
const HOMEPAGE_TITLE_PATTERN = /^Ionic(?:\s*-\s*Trading Solutions API)?$/i
const ABOUT_PAGE_TITLE_PATTERN = /^About\s*-\s*Ionic$/i
const BLANK_ADJACENT_TITLE_PATTERN = /^Ionic$/i
const DOCUMENTATION_URL_PATTERN = /^https:\/\/dev\.api\.ionic\.trade\/(?:docs\/?)?$/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const DOCUMENTATION_URL = PROVIDER_METADATA.documentationUrl
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const ADJACENT_ROUTE_URLS = [...PROVIDER_METADATA.adjacentRouteUrls]

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

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const extractAnchors = (html = '') => Array.from(
  String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ([, href, label]) => ({
    href,
    label: normalizeWhitespace(label),
  }),
)

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const title = extractTitle(page)
  const anchors = extractAnchors(page)

  return HOMEPAGE_TITLE_PATTERN.test(title)
    && text.includes('Solana Trading Infrastructure')
    && text.includes('Real-time Trading Data for Solana')
    && text.includes('Access live market data, historical charts, holder analytics, and trader insights')
    && anchors.some((anchor) =>
      anchor.label === 'View Documentation'
      && DOCUMENTATION_URL_PATTERN.test(anchor.href),
    )
}

export const hasLinkedPublicJobsSurface = (html = '') =>
  extractAnchors(html).some((anchor) => PUBLIC_JOBS_SIGNAL_PATTERN.test(`${anchor.label} ${anchor.href}`))

export const isExpectedUnavailableSurface = (surface = {}) =>
  ['timeout', 'dns', 'network'].includes(surface?.errorKind)
  && !Number.isInteger(surface?.status)
  && surface?.html == null

const isExpectedHomepageLikeSurface = (surface = {}) =>
  Number.isInteger(surface?.status)
  && surface.status > 0
  && hasOfficialHomepageSignal(surface?.html)
  && !hasLinkedPublicJobsSurface(surface?.html)

const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return ABOUT_PAGE_TITLE_PATTERN.test(extractTitle(page) || '')
    && text.includes('Solana Trading API')
    && text.includes('Real-time market data, wallet analytics, and trading infrastructure.')
    && !hasLinkedPublicJobsSurface(page)
}

const hasOfficialBlankAdjacentShellSignal = (html = '') => {
  const page = String(html ?? '')

  return BLANK_ADJACENT_TITLE_PATTERN.test(extractTitle(page) || '')
    && normalizeWhitespace(page) === 'Ionic'
    && extractAnchors(page).length === 0
}

const isExpectedAdjacentRouteSurface = (surface = {}) => {
  if (!Number.isInteger(surface?.status) || surface.status <= 0) return false

  const pageUrl = String(surface?.finalUrl || surface?.url || '')

  if (/\/about\/?$/i.test(pageUrl)) {
    return hasOfficialAboutPageSignal(surface?.html)
  }

  if (/\/(?:careers|jobs|contact)\/?$/i.test(pageUrl)) {
    return hasOfficialBlankAdjacentShellSignal(surface?.html)
  }

  return false
}

export const isUnexpectedReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status)
  && surface.status > 0
  && PUBLIC_JOBS_SIGNAL_PATTERN.test(normalizeWhitespace(surface?.html))

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true

  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(causeCode)
    || TIMEOUT_ERROR_PATTERN.test(causeMessage)
    || TIMEOUT_ERROR_PATTERN.test(message)
}

const isDnsError = (error) => {
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(causeCode)
    || /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(causeMessage)
    || /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)
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

export const createIonicTradingScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    const homepageSurface = await probeUrl(HOMEPAGE_URL)

    if (isExpectedUnavailableSurface(homepageSurface)) {
      const adjacentSurfaces = await Promise.all(ADJACENT_ROUTE_URLS.map((url) => probeUrl(url)))

      if (
        adjacentSurfaces.every((surface) =>
          isExpectedUnavailableSurface(surface)
          || isExpectedHomepageLikeSurface(surface)
          || isExpectedAdjacentRouteSurface(surface),
        )
      ) {
        return []
      }

      for (const surface of adjacentSurfaces) {
        if (isUnexpectedReachableSurface(surface)) {
          throw new Error(`${COMPANY} public jobs surface now appears reachable: ${surface.finalUrl || surface.url}`)
        }

        if (!isExpectedUnavailableSurface(surface) && !isExpectedHomepageLikeSurface(surface) && !isExpectedAdjacentRouteSurface(surface)) {
          throw new Error(`${COMPANY} verified adjacent route changed materially: ${surface.finalUrl || surface.url}`)
        }
      }

      return []
    }

    if (!isExpectedHomepageLikeSurface(homepageSurface)) {
      throw new Error('Ionic Trading verified homepage no longer matches the trusted first-party surface')
    }

    for (const url of ADJACENT_ROUTE_URLS) {
      const surface = await probeUrl(url)

      if (isExpectedUnavailableSurface(surface)) continue
      if (isExpectedHomepageLikeSurface(surface)) continue
      if (isExpectedAdjacentRouteSurface(surface)) continue

      if (isUnexpectedReachableSurface(surface)) {
        throw new Error(`${COMPANY} public jobs surface now appears reachable: ${surface.finalUrl || surface.url}`)
      }

      throw new Error(`${COMPANY} verified adjacent route changed materially: ${surface.finalUrl || surface.url}`)
    }

    return []
  },
})

export const run = async (options = {}) => createIonicTradingScraper().run(options)

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
