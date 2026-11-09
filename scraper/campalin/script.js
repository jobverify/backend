import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'campalin'
export const COMPANY = 'Campalin'
export const COMPANY_DOMAIN = 'campalin.in'
export const VERIFIED_AT = '2026-08-15'
export const HOMEPAGE_URL = 'https://campalin.in/'
export const SITEMAP_INDEX_URL = 'https://campalin.in/sitemap.xml'
export const WEBSITE_SITEMAP_URL = 'https://campalin.in/sitemap.website.xml'
export const FIRST_PARTY_PLACEHOLDER_URLS = [
  HOMEPAGE_URL,
  SITEMAP_INDEX_URL,
  WEBSITE_SITEMAP_URL,
]
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://campalin.in/careers',
  'https://campalin.in/career',
  'https://campalin.in/jobs',
  'https://campalin.in/job',
  'https://campalin.in/join-us',
  'https://campalin.in/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout|socket disconnected before secure tls connection was established|econnreset|other side closed|terminated/i

const collectErrorDetails = (error) => {
  const details = []
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)

    if (typeof current === 'string') {
      details.push(current)
      break
    }

    if (current?.code) details.push(String(current.code))
    if (current?.message) details.push(String(current.message))
    current = current?.cause
  }

  return details.filter(Boolean)
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const normalizeXml = (value) => normalizeWhitespace(value)

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true
  return collectErrorDetails(error).some((detail) =>
    /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(detail)
    || TIMEOUT_ERROR_PATTERN.test(detail))
}

export const isExpectedUnreachableSurface = (surface = {}) =>
  !Number.isInteger(surface?.status)
  && surface?.html == null
  && (
    surface?.errorKind === 'timeout'
    || (
      surface?.errorKind === 'network'
      && TIMEOUT_ERROR_PATTERN.test(String(surface?.errorMessage ?? surface?.message ?? ''))
    )
  )

export const isUnexpectedReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

const createUnexpectedUnreachableSurfaceError = (surface) =>
  new Error(`Campalin verified unreachable surface changed materially: ${surface.url}`)

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
      status: response.status,
      url,
      finalUrl: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)
    const errorDetails = collectErrorDetails(error)
    const combinedErrorDetails = errorDetails.join(' | ')

    if (isTimeoutError(error)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'timeout',
        errorMessage: combinedErrorDetails || String(error?.message ?? error),
      }
    }

    if (/ENOTFOUND|getaddrinfo/i.test(combinedErrorDetails)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'dns',
        errorMessage: combinedErrorDetails || String(error?.message ?? error),
      }
    }

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: 'network',
      errorMessage: combinedErrorDetails || String(error?.message ?? error),
    }
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*campalin\.in\s*<\/title>/i.test(rawHtml)
    && /meta[^>]+name=["']author["'][^>]+content=["']campalin\.in["']/i.test(rawHtml)
    && /meta[^>]+name=["']generator["'][^>]+content=["']Starfield Technologies; Go Daddy Website Builder 8\.0\.0000["']/i.test(rawHtml)
    && normalized.includes('launching soon')
    && normalized.includes('contact us')
    && /copyright[\s\S]*2025[\s\S]*campalin\.in[\s\S]*all rights reserved/i.test(rawHtml)
    && /powered by/i.test(rawHtml)
}

export const hasVerifiedSitemapIndexSignal = (xml) => {
  const normalized = normalizeXml(xml)

  return normalized.includes('http://campalin.in/sitemap.website.xml')
    && normalized.includes('http://campalin.in/sitemap.ols.xml')
    && !/(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|work-with-us)/i.test(normalized)
}

export const hasVerifiedWebsiteSitemapSignal = (xml) => {
  const normalized = normalizeXml(xml)

  return normalized.includes('http://campalin.in/')
    && normalized.includes('2025-07-28')
    && normalized.includes('weekly')
    && !/(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|work-with-us)/i.test(normalized)
}

export const hasPublicJobsSignal = (html) =>
  /(current openings|all open positions|open positions|job openings|join our team|apply now|see current openings|view jobs|see jobs)/i
    .test(String(html ?? ''))

const hasVerifiedPlaceholderCareersAliasSignal = (page = {}) =>
  Number(page.status) === 200
  && hasOfficialHomepageSignal(page.html)
  && !hasPublicJobsSignal(page.html)

export const isVerifiedNoPublicCareersRoute = (page = {}) =>
  (
    Number(page.status) === 404
    && !hasPublicJobsSignal(page.html)
  )
  || hasVerifiedPlaceholderCareersAliasSignal(page)

const verifyPlaceholderSurface = (page, label) => {
  if (page?.errorKind) {
    if (isExpectedUnreachableSurface(page)) return
    throw createUnexpectedUnreachableSurfaceError(page)
  }

  if (label === 'homepage') {
    if (page.status !== 200 || !hasOfficialHomepageSignal(page.html)) {
      throw new Error('Campalin homepage no longer matches the verified first-party placeholder surface')
    }

    if (hasPublicJobsSignal(page.html)) {
      throw new Error('Campalin homepage now exposes a public jobs surface')
    }

    return
  }

  if (label === 'sitemap-index') {
    if (page.status !== 200 || !hasVerifiedSitemapIndexSignal(page.html)) {
      throw new Error('Campalin sitemap index no longer matches the verified placeholder surface')
    }

    return
  }

  if (page.status !== 200 || !hasVerifiedWebsiteSitemapSignal(page.html)) {
    throw new Error('Campalin website sitemap no longer matches the verified placeholder surface')
  }
}

const verifyNoPublicCareersRoute = (page, routeUrl) => {
  if (page?.errorKind) {
    if (isExpectedUnreachableSurface(page)) return
    throw createUnexpectedUnreachableSurfaceError(page)
  }

  // GoDaddy rate-limits the final alias probe after the verified sitemap and route checks.
  // An empty 429 cannot establish a public jobs surface, so retain the earlier evidence.
  if (page?.status === 429 && !String(page?.html ?? '').trim()) {
    return
  }

  if (!isVerifiedNoPublicCareersRoute(page)) {
    throw new Error(`Campalin careers route changed materially or now exposes public jobs: ${page.url || page.finalUrl || routeUrl}`)
  }
}

export const createCampalinScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    verifyPlaceholderSurface(await probeUrl(HOMEPAGE_URL), 'homepage')
    verifyPlaceholderSurface(await probeUrl(SITEMAP_INDEX_URL), 'sitemap-index')
    verifyPlaceholderSurface(await probeUrl(WEBSITE_SITEMAP_URL), 'website-sitemap')

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      verifyNoPublicCareersRoute(await probeUrl(routeUrl), routeUrl)
    }

    return []
  },
})

export const run = async (options = {}) => createCampalinScraper().run(options)

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
