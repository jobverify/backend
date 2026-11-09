import { readFileSync } from 'node:fs'
import { runReviewedThirdWaveDarwinboxInventory } from './nativeInventory.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STAN_PLUS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i
const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(current openings|open positions|job openings|job postings|search jobs|apply|career opportunities)\b/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const DARWINBOX_TIMEOUT_ROUTE_URLS = [...PROVIDER_METADATA.darwinboxTimeoutRouteUrls]
export const DARWINBOX_LISTING_API_URL = PROVIDER_METADATA.darwinboxListingApiUrl

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

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/redhealth\.darwinbox\.in\/ms\/candidatev2\/main/i)
  return match?.[0] ?? null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Ambulance Services | RED.Health Products - Quality Care'
    && text.includes("WE'RE BUILDING INDIA'S 911")
    && text.includes('CAN WE COUNT YOU IN?')
    && text.includes('Discover Roles')
    && text.includes('HIRING PROCESS')
    && text.includes('Profile Screening')
    && text.includes('Panel Interviews')
    && text.includes('Bar Raiser Round')
    && text.includes('Offer Discussion')
}

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const hasBlankDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasNoPublicJobSignals = !PUBLIC_JOBS_SIGNAL_PATTERN.test(normalized)
  const hasCandidateV2ShellSignals =
    /<!doctype html>/i.test(page)
    && /<title>\s*<\/title>/i.test(page)
    && /<app-root\b/i.test(page)
    && /db-components\.esm\.js/i.test(page)
    && /challenges\.cloudflare\.com\/turnstile/i.test(page)
    && (
      /<base[^>]+href=["']\/ms\/candidatev2\/["']/i.test(page)
      || /<base[^>]+href=["']\/ms\/candidate\/["']/i.test(page)
    )

  const hasMinimalCandidateShellSignals =
    /<!doctype html>/i.test(page)
    && /<title>\s*<\/title>/i.test(page)
    && /<app-root\b/i.test(page)
    && normalized.includes('Please enable Javascript!')

  return hasNoPublicJobSignals
    && (hasCandidateV2ShellSignals || hasMinimalCandidateShellSignals)
}

export const hasBlockedDarwinboxListingApiSignal = ({ status = 0, html = '' } = {}) => {
  const text = normalizeWhitespace(html).toLowerCase()

  return Number(status) === 403
    && text.includes('attention required!')
    && text.includes('sorry, you have been blocked')
    && text.includes('you are unable to access darwinbox.in')
    && text.includes('cloudflare ray id')
}

export const hasUnexpectedPublicJobSurface = (surface = {}) =>
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
      url,
      finalUrl: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (isTimeoutError(error)) {
      return {
        status: null,
        url,
        finalUrl: url,
        html: null,
        errorKind: 'timeout',
      }
    }

    if (isDnsError(error)) {
      return {
        status: null,
        url,
        finalUrl: url,
        html: null,
        errorKind: 'dns',
      }
    }

    return {
      status: null,
      url,
      finalUrl: url,
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

const nativeSpec = {
  "source": "stanplus",
  "company": "StanPlus",
  "brand": "StanPlus Technologies  Private Limited",
  "tenant": "redhealth",
  "tenantId": "232",
  "origin": "https://redhealth.darwinbox.in",
  "corporateHandoff": "https://redhealth.darwinbox.in/ms/candidatev2/main",
  "handoff": "https://redhealth.darwinbox.in/ms/candidatev2/main"
}
nativeSpec.review = JSON.parse(readFileSync(new URL('./reviewedNativeScope.json', import.meta.url), 'utf8'))

export const createStanPlusScraper = (defaults = {}) => ({
  run: (options = {}) => runReviewedThirdWaveDarwinboxInventory(nativeSpec, { ...defaults, ...options }),
})

export const run = async (options = {}) => createStanPlusScraper().run(options)

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
