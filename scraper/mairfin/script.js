import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MAIRFIN_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const DNS_ERROR_PATTERN =
  /\bcould not resolve host\b|\bgetaddrinfo\b|\benotfound\b|\beai_again\b|\bnxdomain\b|\bthe remote name could not be resolved\b/i
const TLS_ERROR_PATTERN =
  /\btrust relationship\b|\bssl\/tls\b|\bssl\b|\btls\b|\bcertificate\b|\bcert\b|\bself[- ]signed\b/i
const TIMEOUT_ERROR_PATTERN = /\btimeout\b|\btimed out\b|\bund_err_connect_timeout\b|\betimedout\b/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CANDIDATE_FIRST_PARTY_URLS = [...PROVIDER_METADATA.candidateFirstPartyUrls]

const hasReachableStatus = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const isUnexpectedReachableSurface = (surface = {}) => hasReachableStatus(surface)

export const isExpectedAbsentCandidateSurface = (surface = {}) =>
  ['dns', 'tls'].includes(surface?.errorKind)
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const isExpectedVerificationFailure = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')

  return DNS_ERROR_PATTERN.test(message)
    || DNS_ERROR_PATTERN.test(causeMessage)
    || DNS_ERROR_PATTERN.test(causeCode)
    || TLS_ERROR_PATTERN.test(message)
    || TLS_ERROR_PATTERN.test(causeMessage)
    || TLS_ERROR_PATTERN.test(causeCode)
}

const classifyErrorKind = (error) => {
  if (!error) return 'network'

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

  if (error?.name === 'AbortError'
    || TIMEOUT_ERROR_PATTERN.test(String(error?.message ?? ''))
    || TIMEOUT_ERROR_PATTERN.test(String(error?.cause?.message ?? ''))
    || TIMEOUT_ERROR_PATTERN.test(String(error?.cause?.code ?? ''))
  ) {
    return 'timeout'
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

export const createMairfinScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    for (const url of CANDIDATE_FIRST_PARTY_URLS) {
      const surface = await probeUrl(url)

      if (isExpectedAbsentCandidateSurface(surface)) continue

      if (isUnexpectedReachableSurface(surface)) {
        throw new Error(`${COMPANY} first-party candidate surface now responds and requires re-verification: ${surface.finalUrl || surface.url}`)
      }

      throw new Error(`${COMPANY} verified absent candidate surface changed materially: ${surface.finalUrl || surface.url}`)
    }

    return []
  },
})

export const run = async (options = {}) => createMairfinScraper().run(options)

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
