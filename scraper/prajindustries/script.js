import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PRAJ_INDUSTRIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(current openings|open positions|job openings|job postings|open jobs|search jobs|apply|career opportunities)\b/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const DARWINBOX_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const DARWINBOX_ORIGIN = PROVIDER_METADATA.darwinboxOrigin
export const DARWINBOX_COMPANY_ID = PROVIDER_METADATA.darwinboxCompanyId
export const DARWINBOX_JOBS_URL = PROVIDER_METADATA.darwinboxJobsUrl
export const DARWINBOX_CANDIDATE_CAREERS_URL = PROVIDER_METADATA.darwinboxCandidateCareersUrl
export const DARWINBOX_PUBLIC_HOME_URL = PROVIDER_METADATA.darwinboxPublicHomeUrl
export const DARWINBOX_PUBLIC_ALL_JOBS_URL = PROVIDER_METADATA.darwinboxPublicAllJobsUrl
export const DARWINBOX_LISTING_API_URL = PROVIDER_METADATA.darwinboxListingApiUrl
export const DARWINBOX_SHELL_ROUTE_URLS = [...PROVIDER_METADATA.darwinboxShellRouteUrls]

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
    || /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i.test(causeMessage)
    || /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i.test(message)
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/praj\.darwinbox\.in\/ms\/candidate\/careers/i)
  return match?.[0] ?? null
}

export const hasVerifiedCareersPageSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Careers - Praj Industries'
    && text.includes('prajhumancapitalconnect@praj.net')
    && text.includes('SEARCH FOR JOB')
    && text.includes('Life At Praj')
}

export const hasBlankDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasNoPublicJobSignals = !PUBLIC_JOBS_SIGNAL_PATTERN.test(normalized)
  const hasCandidateShellSignals =
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

  return hasNoPublicJobSignals && (hasCandidateShellSignals || hasMinimalCandidateShellSignals)
}

export const hasBlockedDarwinboxListingApiSignal = ({ status = 0, body = '', html = '' } = {}) => {
  const text = normalizeWhitespace(body || html).toLowerCase()

  return Number(status) === 403
    && text.includes('attention required!')
    && text.includes('sorry, you have been blocked')
    && text.includes('cloudflare ray id')
}

export const hasUnexpectedPublicJobSurface = (surface = {}) =>
  Number(surface?.status) === 200 && PUBLIC_JOBS_SIGNAL_PATTERN.test(normalizeWhitespace(surface?.html))

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

const defaultProbeListingApi = async (url) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      Origin: DARWINBOX_ORIGIN,
      Referer: DARWINBOX_PUBLIC_ALL_JOBS_URL,
    },
    body: JSON.stringify({
      companyId: DARWINBOX_COMPANY_ID,
      sort_option: 'new',
      limit: 10,
      page: 1,
    }),
  })

  return {
    status: response.status,
    body: await response.text(),
  }
}

export const createPrajIndustriesScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    probeListingApi = defaultProbeListingApi,
  } = {}) {
    const careersPage = await fetchPage(OFFICIAL_CAREERS_URL)

    if (careersPage.errorKind || careersPage.status !== 200 || !hasVerifiedCareersPageSignals(careersPage.html)) {
      throw new Error('Praj Industries verified official careers page no longer matches the trusted first-party surface')
    }

    if (extractOfficialDarwinboxUrl(careersPage.html) !== DARWINBOX_HANDOFF_URL) {
      throw new Error('Praj Industries verified Darwinbox handoff changed materially')
    }

    for (const url of DARWINBOX_SHELL_ROUTE_URLS) {
      const surface = await fetchPage(url)

      if (surface.status === 200 && hasBlankDarwinboxShellSignal(surface.html)) {
        continue
      }

      if (hasUnexpectedPublicJobSurface(surface)) {
        throw new Error(
          `Praj Industries public Darwinbox jobs surface now appears reachable: ${surface.finalUrl || surface.url}`,
        )
      }

      throw new Error(`Praj Industries verified unavailable Darwinbox surface changed materially: ${surface.finalUrl || surface.url}`)
    }

    const listingApiResult = await probeListingApi(DARWINBOX_LISTING_API_URL)
    if (!hasBlockedDarwinboxListingApiSignal(listingApiResult)) {
      throw new Error('Praj Industries Darwinbox listing API no longer matches the verified blocked state')
    }

    return []
  },
})

export const run = async (options = {}) => createPrajIndustriesScraper().run(options)

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
