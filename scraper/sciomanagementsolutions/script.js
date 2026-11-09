import https from 'node:https'
import path from 'node:path'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

import SCIOMS_CATALOG from './catalog.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SCIOMS_CATALOG
export const SOURCE = SCIOMS_CATALOG.source
export const COMPANY = SCIOMS_CATALOG.companyName
export const VERIFIED_ON = SCIOMS_CATALOG.verifiedOn
export const CAREERS_URL = SCIOMS_CATALOG.companyCareerPage
export const APPLY_URL = SCIOMS_CATALOG.applyUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const PROTOCOL_PARSE_ERROR_PATTERN =
  /response does not match the http\/1\.1 protocol|invalid header value char|hpe_invalid_header_token|http parser error/i
const LENIENT_TIMEOUT_MS = 15000
const MAX_REDIRECTS = 5

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: LENIENT_TIMEOUT_MS,
  })

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const collectSignals = (html, patterns) => {
  const normalized = normalizeWhitespace(html)
  return patterns.every((pattern) => pattern.test(normalized))
}

const hasVerifiedTitleSignal = (html = '') =>
  /SCIO Management Solutions[^A-Za-z0-9]+Intelligent,\s*Automated RCM Services/i
    .test(normalizeWhitespace(html))

const hasCanonicalHomepageSignal = (html = '') =>
  /<link[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.scioms\.com\/index\.php["']/i
    .test(String(html ?? ''))

const PLACEHOLDER_POSITION_PATTERNS = [
  /^--\s*select position\s*--$/i,
  /^select position$/i,
]

const ACTUAL_PUBLIC_JOB_PATTERNS = [
  /\bjob\s*id\b/i,
  /\brequisition\b/i,
  /\bjob openings?\b/i,
  /\bopen positions?\b/i,
  /\/job(s)?\//i,
]

const isProtocolParseError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  return PROTOCOL_PARSE_ERROR_PATTERN.test(`${message} ${causeCode} ${causeMessage}`)
}

const decompressBuffer = (buffer, encoding = '') => {
  const normalizedEncoding = String(encoding ?? '').toLowerCase()
  if (normalizedEncoding.includes('gzip')) return gunzipSync(buffer)
  if (normalizedEncoding.includes('deflate')) return inflateSync(buffer)
  if (normalizedEncoding.includes('br')) return brotliDecompressSync(buffer)
  return buffer
}

const fetchLenientTextWithRedirects = (url, redirectsRemaining = MAX_REDIRECTS) =>
  new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      insecureHTTPParser: true,
    }, async (response) => {
      const location = response.headers.location
      if (
        location
        && redirectsRemaining > 0
        && Number(response.statusCode) >= 300
        && Number(response.statusCode) < 400
      ) {
        response.resume()
        try {
          resolve(await fetchLenientTextWithRedirects(new URL(location, url).toString(), redirectsRemaining - 1))
        } catch (error) {
          reject(error)
        }
        return
      }

      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        try {
          const body = decompressBuffer(
            Buffer.concat(chunks),
            response.headers['content-encoding'],
          )
          resolve(body.toString('utf8'))
        } catch (error) {
          reject(error)
        }
      })
    })

    request.on('error', reject)
    request.setTimeout(LENIENT_TIMEOUT_MS, () => {
      const timeoutError = new Error(`SCIO Management Solutions lenient HTTP request timed out after ${LENIENT_TIMEOUT_MS}ms`)
      timeoutError.code = 'ETIMEDOUT'
      request.destroy(timeoutError)
    })
    request.end()
  })

const defaultFetchLenientText = (url) => fetchLenientTextWithRedirects(url)

const fetchVerifiedShellText = async (url, {
  fetchText,
  fetchLenientText,
}) => {
  try {
    return await fetchText(url)
  } catch (error) {
    if (!isProtocolParseError(error)) {
      throw error
    }

    return fetchLenientText(url)
  }
}

export const extractPositionOptions = (html = '') =>
  [...String(html ?? '').matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
    .filter((option) => !PLACEHOLDER_POSITION_PATTERNS.some((pattern) => pattern.test(option)))

export const hasVerifiedPlaceholderShellSignal = (html = '') =>
  hasVerifiedTitleSignal(html)
  && hasCanonicalHomepageSignal(html)
  && collectSignals(html, [
    /\bRequest a Consultation\b/i,
    /\bSubmit\b/i,
    /\bClose\b/i,
  ])

export const hasVerifiedCareersSignal = (html = '') => hasVerifiedPlaceholderShellSignal(html)

export const hasVerifiedApplyFormSignal = (html = '') => hasVerifiedPlaceholderShellSignal(html)

export const hasPublicJobListingsSignal = (html = '') =>
  extractPositionOptions(html).length > 0
  || ACTUAL_PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createScioManagementSolutionsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchLenientText = defaultFetchLenientText,
  } = {}) {
    const careersHtml = await fetchVerifiedShellText(CAREERS_URL, {
      fetchText,
      fetchLenientText,
    })

    if (hasPublicJobListingsSignal(careersHtml)) {
      throw new Error('SCIO Management Solutions careers surface now exposes public positions')
    }

    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified SCIO Management Solutions careers shell')
    }

    const applyHtml = await fetchVerifiedShellText(APPLY_URL, {
      fetchText,
      fetchLenientText,
    })

    if (hasPublicJobListingsSignal(applyHtml)) {
      throw new Error('SCIO Management Solutions careers surface now exposes public positions')
    }

    if (!hasVerifiedApplyFormSignal(applyHtml)) {
      throw new Error('Response is not the verified SCIO Management Solutions apply form shell')
    }

    return []
  },
})

export const run = async (options = {}) => createScioManagementSolutionsScraper().run(options)

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
