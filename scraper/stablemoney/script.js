import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STABLE_MONEY_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i
const TRUSTWORTHY_JOB_HOST_PATTERN =
  /(?:jobs\.lever\.co|api\.lever\.co|boards-api\.greenhouse\.io|job-boards\.greenhouse\.io|boards\.greenhouse\.io|darwinbox\.(?:in|com)|myworkdayjobs\.com|workdayjobs\.com|smartrecruiters\.com|ashbyhq\.com|workable\.com|jobvite\.com|icims\.com|greenhouse\.io)/i
const FIRST_PARTY_JOB_PATH_PATTERN = /\/(?:jobs|careers|openings|join-us|work-with-us)\/[a-z0-9][a-z0-9-]*(?:\/)?$/i
const VISIBLE_JOBS_TEXT_PATTERN = /\b(current openings|open positions|job openings|career opportunities|join our team)\b/i
const VISIBLE_APPLY_TEXT_PATTERN = /\b(apply now|view job|job title|department|location)\b/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OFFICIAL_FIRST_PARTY_ROUTE_URLS = [...PROVIDER_METADATA.officialFirstPartyUrls]
export const NO_PUBLIC_JOBS_ROUTE_URLS = [...PROVIDER_METADATA.noPublicJobsRouteUrls]
export const FIRST_PARTY_TIMEOUT_URLS = [
  ...OFFICIAL_FIRST_PARTY_ROUTE_URLS,
  ...NO_PUBLIC_JOBS_ROUTE_URLS,
]

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

const isReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

const isUnavailableSurface = (surface = {}) =>
  surface?.errorKind
  && !isReachableSurface(surface)
  && surface?.html == null

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const stripScriptsAndStyles = (html = '') => String(html ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const hasTrustworthyJobAnchor = (html = '') => {
  const visibleHtml = stripScriptsAndStyles(html)

  for (const match of visibleHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = normalizeWhitespace(match[1])
    const text = normalizeWhitespace(match[2]) || ''
    if (!href) continue

    if (TRUSTWORTHY_JOB_HOST_PATTERN.test(href)) return true
    if (
      FIRST_PARTY_JOB_PATH_PATTERN.test(href)
      && /\b(apply|job|role|position|engineer|manager|analyst|developer)\b/i.test(text)
    ) {
      return true
    }
  }

  return false
}

export const isUnexpectedPublicJobsSurface = (surface = {}) => {
  if (!isReachableSurface(surface) || surface.status >= 400) return false

  const html = String(surface?.html ?? '')
  const visibleText = normalizeWhitespace(stripScriptsAndStyles(html)) || ''

  return hasTrustworthyJobAnchor(html)
    || (
      VISIBLE_JOBS_TEXT_PATTERN.test(visibleText)
      && VISIBLE_APPLY_TEXT_PATTERN.test(visibleText)
    )
}

export const isUnexpectedReachableSurface = isUnexpectedPublicJobsSurface

export const hasExpectedOfficialFirstPartySignal = (surface = {}) => {
  if (!isReachableSurface(surface) || surface.status !== 200) return false

  const url = String(surface.finalUrl || surface.url || '')
  const title = extractTitle(surface.html) || ''
  const text = normalizeWhitespace(surface.html) || ''

  if (url === 'https://stablemoney.in/') {
    return /^Stable Money - /i.test(title)
      && /Stable Money/i.test(text)
      && /Fixed Deposits/i.test(text)
  }

  if (url === 'https://stablemoney.in/about-us') {
    return /^About Stable Money\b/i.test(title)
      && /About Stable Money|Stable-Alpha Technologies Private Limited/i.test(text)
  }

  if (url === 'https://stablemoney.in/contact-us') {
    return /^Contact Us\b/i.test(title)
      && /help@stablemoney\.in|Connect with the Stable Money Team/i.test(text)
  }

  return false
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

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
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
  } finally {
    clearTimeout(timeout)
  }
}

const buildUpstreamUnavailableError = (surface = {}) => Object.assign(
  new Error(
    `${COMPANY} official first-party surface is temporarily unavailable (${surface.errorKind || 'network'}): ${surface.finalUrl || surface.url}`,
  ),
  {
    softFailure: true,
    upstreamOutage: true,
    abortRetries: true,
    failureKind: 'network_or_timeout',
  },
)

const assertVerifiedOfficialFirstPartySurface = (surface) => {
  if (isUnavailableSurface(surface)) {
    throw buildUpstreamUnavailableError(surface)
  }

  if (!hasExpectedOfficialFirstPartySignal(surface)) {
    throw new Error(`${COMPANY} verified official first-party surface changed materially: ${surface.url}`)
  }

  if (isUnexpectedPublicJobsSurface(surface)) {
    throw new Error(`${COMPANY} official first-party route now exposes a public jobs surface: ${surface.finalUrl || surface.url}`)
  }
}

const assertNoPublicJobsSurface = (surface) => {
  if (isExpectedTimedOutSurface(surface)) return

  if (isUnexpectedPublicJobsSurface(surface)) {
    throw new Error(`${COMPANY} public jobs surface now appears reachable: ${surface.finalUrl || surface.url}`)
  }

  if (isReachableSurface(surface)) return

  throw new Error(`${COMPANY} verified no-public-jobs surface changed materially: ${surface.url}`)
}

export const createStableMoneyScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    for (const url of OFFICIAL_FIRST_PARTY_ROUTE_URLS) {
      const surface = await probeUrl(url)
      assertVerifiedOfficialFirstPartySurface(surface)
    }

    for (const url of NO_PUBLIC_JOBS_ROUTE_URLS) {
      const surface = await probeUrl(url)
      assertNoPublicJobsSurface(surface)
    }

    return []
  },
})

export const run = async (options = {}) => createStableMoneyScraper().run(options)

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
