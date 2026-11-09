import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SMARTER_BHARAT_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SMARTER_BHARAT_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CANDIDATE_FIRST_PARTY_URLS = PROVIDER_METADATA.candidateFirstPartyUrls

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const isExpectedAbsentCandidateSurface = ({ errorKind, status } = {}) =>
  errorKind === 'dns' && status == null

export const isUnexpectedReachableSurface = ({ status, html } = {}) =>
  Number(status) >= 200 && Number(status) < 400 && normalizeWhitespace(html).length >= 0

export const classifyProbeErrorKind = ({ message, causeMessage } = {}) => {
  const combinedMessage = `${message ?? ''} ${causeMessage ?? ''}`.trim()

  if (/could not resolve host|enotfound|getaddrinfo/i.test(combinedMessage)) {
    return 'dns'
  }

  if (/timed out|timeout|abort/i.test(combinedMessage)) {
    return 'timeout'
  }

  if (/certificate|ssl|tls|secure tls connection/i.test(combinedMessage)) {
    return 'tls'
  }

  return 'network'
}

export const isExpectedVerificationFailure = ({ message, causeMessage } = {}) =>
  classifyProbeErrorKind({ message, causeMessage }) === 'dns'

const defaultProbeUrl = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    const message = String(error?.message ?? '')
    const causeMessage = String(error?.cause?.message ?? '')
    const errorKind = classifyProbeErrorKind({ message, causeMessage })

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind,
      message: [message, causeMessage].filter(Boolean).join(' | '),
    }
  }
}

export const createSmarterBharatScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    for (const url of CANDIDATE_FIRST_PARTY_URLS) {
      const result = await probeUrl(url)

      if (isExpectedAbsentCandidateSurface(result)) continue

      if (isUnexpectedReachableSurface(result)) {
        throw new Error('SmarterBharat first-party candidate surface changed materially and must be re-verified')
      }

      throw new Error('SmarterBharat exact-name verification changed materially and must be re-verified')
    }

    return []
  },
})

export const run = async (options = {}) => createSmarterBharatScraper().run(options)

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
