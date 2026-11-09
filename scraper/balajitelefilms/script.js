import { createCurrentBalaji } from "./currentPublic.js"
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'balajitelefilms'
export const COMPANY = 'Balaji Telefilms'
export const HOMEPAGE_URL = 'https://www.balajitelefilms.com/'
export const CAREERS_URL = 'https://www.balajitelefilms.com/career-opportunity.php'
export const MISSING_ROUTE_URLS = [
  'https://www.balajitelefilms.com/careers',
  'https://www.balajitelefilms.com/career',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
]

const stripHtmlComments = (value) =>
  String(value ?? '').replace(/<!--[\s\S]*?-->/g, ' ')

const normalizeWhitespace = (value) =>
  stripHtmlComments(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const TLS_CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'ERR_CERT_DATE_INVALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])

const hasTlsCertificateError = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)

    const code = normalizeWhitespace(current?.code)?.toUpperCase()
    if (code && TLS_CERTIFICATE_ERROR_CODES.has(code)) {
      return true
    }

    const message = normalizeWhitespace(current?.message || current)
    if (message && /unable to verify the first certificate|certificate has expired|self signed certificate|unable to get local issuer certificate/i.test(message)) {
      return true
    }

    current = current?.cause
  }

  return false
}

export const fetchPageIgnoringTlsErrors = (url, redirectCount = 0) => new Promise((resolve, reject) => {
  if (redirectCount > 5) {
    reject(new Error(`Too many redirects while loading ${url}`))
    return
  }

  const target = new URL(url)
  const request = https.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || 443,
    path: `${target.pathname}${target.search}`,
    method: 'GET',
    rejectUnauthorized: true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  }, (response) => {
    const status = Number(response.statusCode) || 0
    const location = normalizeWhitespace(response.headers?.location)
    if (location && status >= 300 && status < 400) {
      response.resume()
      const redirectedUrl = new URL(location, url).toString()
      fetchPageIgnoringTlsErrors(redirectedUrl, redirectCount + 1).then(resolve, reject)
      return
    }

    let html = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      html += chunk
    })
    response.on('end', () => {
      resolve({
        status,
        url,
        html,
      })
    })
    response.on('error', reject)
  })

  request.setTimeout(15000, () => {
    request.destroy(new Error(`TLS fallback timed out for ${url}`))
  })
  request.on('error', reject)
  request.end()
})

export const createDefaultFetchPage = ({
  fetchImpl = fetch,
  fetchInsecurePageImpl = fetchPageIgnoringTlsErrors,
} = {}) => async (url) => {
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: createTimeoutSignal(15000),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  } catch (error) {
    if (!hasTlsCertificateError(error)) {
      throw error
    }

    return fetchInsecurePageImpl(url)
  }
}

const defaultFetchPage = createDefaultFetchPage()

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const extractApplicationEmail = (html) => {
  const match = String(html ?? '').match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  )

  return match?.[0]?.toLowerCase() ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Balaji Telefilms(?:\s+Limited\s*:\s*Television,\s*Motion Pictures)?\s*<\/title>/i.test(page)
    && hasVerifiedCareersLink(page)
    && normalized.includes('balaji telefilms')
}

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/www\.balajitelefilms\.com\/)?career-opportunity\.php["']/i.test(String(html ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Balaji Telefilms(?:\s+Limited\s*:\s*Television,\s*Motion Pictures)?\s*<\/title>/i.test(page)
    && hasVerifiedCareersLink(page)
    && normalized.includes('for a career with balaji telefilms ltd')
    && normalized.includes('careers@balajitelefilms.com')
}

export const hasEmailOnlyCareersSignal = (html) => {
  const normalized = normalizeText(html)

  return extractApplicationEmail(html) === 'careers@balajitelefilms.com'
    && normalized.includes('please send your resume to careers@balajitelefilms.com')
}

export const hasVerifiedIncapsulaBlockedShell = (html) => {
  const page = String(html ?? '')

  return /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,\s*nofollow["']/i.test(page)
    && (
      /<iframe[^>]+id=["']main-iframe["'][^>]+src=["']\/_Incapsula_Resource\?/i.test(page)
      || /<script[^>]+src=["']\/_Incapsula_Resource\?/i.test(page)
    )
}

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(stripHtmlComments(html)))

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return status === 404
    && (
      (
        /<title>\s*404 Not Found\s*<\/title>/i.test(page)
        && normalized.includes('not found')
        && normalized.includes('the requested url was not found on this server')
      )
      || (
        /id=["']sk-loader["']/i.test(page)
        && /_skz_pid/i.test(page)
      )
    )
}

export const createBalajiTelefilmsScraper = () => createCurrentBalaji()

export const run = async (options = {}) => createBalajiTelefilmsScraper().run(options)

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
