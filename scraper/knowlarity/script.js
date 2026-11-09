import { execFile as execFileCallback } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { KNOWLARITY_CATALOG } from './catalog.js'
import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const execFile = promisify(execFileCallback)

export const PROVIDER_METADATA = KNOWLARITY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const CURL_METADATA_MARKER = '\n__KNOWLARITY_CURL_METADATA__'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractNextDataText = (html = '') =>
  String(html ?? '').match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? null

const JOB_OPENING_PLACEHOLDER_FIELDS = [
  'JobTitle',
  'Tenure',
  'Location',
  'LocationPath',
  'Department',
  'DepartmentPath',
  'Experience',
  'publishDate',
  'Description',
  'Responsibility',
  'DesiredProfile',
  'FunctionalCompetencies',
  'Fulltime',
  'Duration',
  'DatePublished',
]

const parseEmbeddedJobOpenings = (html = '') => {
  const nextData = extractNextDataText(html)
  if (!nextData) return null

  try {
    const parsed = JSON.parse(nextData)
    const jobOpening = parsed?.props?.pageProps?.jobOpening
    return Array.isArray(jobOpening) ? jobOpening : null
  } catch {
    return null
  }
}

const isVerifiedNullJobOpeningPlaceholder = (record) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false
  if (!Number.isInteger(record.id) || record.id <= 0) return false
  if (!JOB_OPENING_PLACEHOLDER_FIELDS.every(
    (field) => Object.prototype.hasOwnProperty.call(record, field) && record[field] === null,
  )) return false

  return ['published_at', 'created_at', 'updated_at'].every((field) => (
    typeof record[field] === 'string'
    && Number.isFinite(Date.parse(record[field]))
  ))
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Best B2B Company to Work for\s*-\s*Jobs\s*@\s*Knowlarity India\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.knowlarity\.com\/careers["']/i.test(page)
    && text.includes('Join us to create impact')
    && text.includes('Build a career of your potential')
    && text.includes('JOB OPENINGS')
    && text.includes('Location')
    && text.includes('Department')
    && text.includes('EMAIL US YOUR RESUME')
    && text.includes('Not Matched any profile')
  }

export const hasEmbeddedEmptyJobOpeningState = (html = '') => {
  const jobOpenings = parseEmbeddedJobOpenings(html)
  return Array.isArray(jobOpenings) && jobOpenings.length === 0
}

export const hasVerifiedNoRenderableJobOpeningState = (html = '') => {
  const jobOpenings = parseEmbeddedJobOpenings(html)
  return Array.isArray(jobOpenings)
    && (jobOpenings.length === 0 || jobOpenings.every(isVerifiedNullJobOpeningPlaceholder))
}

export const hasRenderablePublicJobsSignal = (html = '') => {
  const nextData = extractNextDataText(html)
  const page = String(html ?? '')
  const text = stripTags(html) || ''

  if (/accordion-item/i.test(page) || /\bLocation:\s*[A-Za-z]/i.test(text)) {
    return true
  }

  if (nextData) {
    return !hasVerifiedNoRenderableJobOpeningState(html)
  }

  return /\bApply now\b/i.test(text)
}

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

const isLeafSignatureError = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)
    if (current.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return true
    if (/unable to verify (?:the )?(?:first certificate|leaf signature)/i.test(current.message || '')) {
      return true
    }
    current = current.cause
  }

  return false
}

const isExactKnowlarityCareersUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.hostname === 'www.knowlarity.com'
      && /^\/careers\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

const fetchWithNativeCurl = async (url, { runExecFile, signal }) => {
  const { stdout } = await runExecFile(process.platform === 'win32' ? 'curl.exe' : 'curl', [
    '--disable',
    '--fail-with-body',
    '--silent',
    '--show-error',
    '--location',
    '--max-redirs', '5',
    '--connect-timeout', '10',
    '--max-time', '30',
    '--user-agent', USER_AGENT,
    '--header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '--write-out', `${CURL_METADATA_MARKER}%{http_code}\t%{url_effective}`,
    '--proto', '=https',
    '--proto-redir', '=https',
    url,
  ], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    signal,
    windowsHide: true,
  })

  const markerIndex = stdout.lastIndexOf(CURL_METADATA_MARKER)
  if (markerIndex < 0) {
    throw new Error('Knowlarity native HTTPS response omitted HTTP metadata')
  }

  const html = stdout.slice(0, markerIndex)
  const [statusText, finalUrl] = stdout.slice(markerIndex + CURL_METADATA_MARKER.length).split('\t')
  const status = Number.parseInt(statusText, 10)
  if (!Number.isInteger(status) || !isExactKnowlarityCareersUrl(finalUrl)) {
    throw new Error('Knowlarity native HTTPS response left the exact first-party careers URL')
  }

  return { status, url: finalUrl, html }
}

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  execFile: runExecFile = execFile,
  timeoutMs = 15000,
} = {}) => {
  const signal = createTimeoutSignal(timeoutMs)
  let response

  try {
    response = await fetchImpl(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal,
    })
  } catch (error) {
    if (!isExactKnowlarityCareersUrl(url) || !isLeafSignatureError(error)) throw error
    return fetchWithNativeCurl(url, { runExecFile, signal })
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isBrowserFallbackError = (error) =>
  /fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to verify the first certificate|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createKnowlarityScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchBrowserPage } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserPageFetcher = fetchBrowserPage || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchPage(url)
    })

    const fetchVerifiedPage = async (url) => {
      try {
        return await fetchPage(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserPageFetcher(url)
      }
    }

    try {
      const careersPage = await fetchVerifiedPage(CAREERS_URL)

      if (hasRenderablePublicJobsSignal(careersPage.html)) {
        throw new Error('Knowlarity careers page now exposes a live public jobs surface')
      }

      if (careersPage.status !== 200 || !hasVerifiedCareersPageSignal(careersPage.html)) {
        throw new Error('Knowlarity careers page no longer matches the verified first-party empty-state shell')
      }

      if (!hasVerifiedNoRenderableJobOpeningState(careersPage.html)) {
        throw new Error('Knowlarity careers page no longer matches the verified first-party empty-state shell')
      }

      return []
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createKnowlarityScraper().run(options)

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
