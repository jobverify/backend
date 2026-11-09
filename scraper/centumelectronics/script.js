import path from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import {
  DEFAULT_DNS_LOOKUP_TIMEOUT_MS,
  resolveHostAddressesWithTimeout,
} from '../../scraper-support/utils/dnsHostResolution.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'centumelectronics'
export const COMPANY = 'Centum Electronics'
export const VERIFIED_ON = '2026-07-14'
export const VERIFIED_SURFACE_SUMMARY =
  'On July 14, 2026, the first-party homepage linked India careers to http://careers.centumelectronics.com/, but that host did not resolve publicly and the obvious main-domain careers routes returned 404.'

export const BRAND_HOME_URL = 'https://www.centumelectronics.com/'
export const INDIA_CAREERS_HANDOFF_URL = 'http://careers.centumelectronics.com/'
export const INDIA_CAREERS_HOST = 'careers.centumelectronics.com'
export const EUROPE_NA_CAREERS_URL = 'https://centumtns.recruitee.com/'
export const DNS_LOOKUP_TIMEOUT_MS = DEFAULT_DNS_LOOKUP_TIMEOUT_MS

export const COMMON_CAREER_ROUTE_PROBES = Object.freeze([
  {
    url: 'https://www.centumelectronics.com/careers',
    expectedStatus: 404,
  },
  {
    url: 'https://www.centumelectronics.com/career',
    expectedStatus: 404,
  },
  {
    url: 'https://www.centumelectronics.com/jobs',
    expectedStatus: 404,
  },
  {
    url: 'https://www.centumelectronics.com/job-openings',
    expectedStatus: 404,
  },
])

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const RECOVERABLE_CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
])

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8211;/gi, '–')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const isRecoverableCentumCertificateError = (url, error) => {
  const code = error?.cause?.code || error?.code
  if (!RECOVERABLE_CERTIFICATE_ERROR_CODES.has(code)) return false

  try {
    return new URL(url).hostname === 'www.centumelectronics.com'
  } catch {
    return false
  }
}

const fetchPageWithInvalidCertificate = (url, redirectCount = 0) => new Promise((resolve, reject) => {
  const request = https.request(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    rejectUnauthorized: true,
    timeout: 15000,
  }, (response) => {
    const status = response.statusCode || 0
    const location = response.headers.location

    if (status >= 300 && status < 400 && location && redirectCount < 3) {
      response.resume()
      resolve(fetchPageWithInvalidCertificate(new URL(location, url).href, redirectCount + 1))
      return
    }

    let html = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      html += chunk
    })
    response.on('end', () => {
      resolve({ status, url, html })
    })
  })

  request.on('timeout', () => request.destroy(new Error(`Timeout fetching ${url}`)))
  request.on('error', reject)
  request.end()
})

const defaultFetchPage = async (url) => {
  let response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
  } catch (error) {
    if (isRecoverableCentumCertificateError(url, error)) {
      return fetchPageWithInvalidCertificate(url)
    }

    throw error
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractIndiaCareersHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(/http:\/\/careers\.centumelectronics\.com\/?/i)
  return match ? INDIA_CAREERS_HANDOFF_URL : null
}

export const extractEuropeNorthAmericaCareersUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/centumtns\.recruitee\.com\/?/i)
  return match ? EUROPE_NA_CAREERS_URL : null
}

export const hasCentumHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Centum\s*(?:&#8211;|–|-)\s*TEAM WORK \| TECHNOLOGY \| TRUST\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Global Presence, Innovative Engineering, Advanced Manufacturing')
    && normalized.includes('CENTUM GROUP, A GLOBAL COMPANY CLOSE TO ITS CUSTOMERS')
    && /(?:©|Â©)(?:\s+2023)?\s+Centum\. All rights reserved\./i.test(normalized)
    && extractIndiaCareersHandoffUrl(rawHtml) === INDIA_CAREERS_HANDOFF_URL
}

export const hasResolvableFirstPartyCareersHost = (addresses) =>
  Array.isArray(addresses) && addresses.length > 0

export const resolveCareerHost = async (
  host = INDIA_CAREERS_HOST,
  {
    resolve4Impl,
    resolve6Impl,
    timeoutMs = DNS_LOOKUP_TIMEOUT_MS,
  } = {},
) => resolveHostAddressesWithTimeout([host], {
  resolve4Impl,
  resolve6Impl,
  timeoutMs,
})

export const createCentumElectronicsScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    resolveCareerHost: resolveCareerHostImpl = resolveCareerHost,
  } = {}) {
    const homepage = await fetchPage(BRAND_HOME_URL)

    if (!hasCentumHomepageSignal(homepage.html)) {
      throw new Error('Verified Centum Electronics homepage no longer matches the known first-party careers surface')
    }

    const addresses = await resolveCareerHostImpl(INDIA_CAREERS_HOST)
    if (hasResolvableFirstPartyCareersHost(addresses)) {
      throw new Error('Centum Electronics first-party India careers host now resolves; re-verify the public jobs surface before trusting []')
    }

    for (const probe of COMMON_CAREER_ROUTE_PROBES) {
      const routePage = await fetchPage(probe.url)

      if (routePage.status !== probe.expectedStatus) {
        throw new Error(`Common Centum Electronics careers route changed: ${probe.url} now returns ${routePage.status}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCentumElectronicsScraper().run(options)

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
