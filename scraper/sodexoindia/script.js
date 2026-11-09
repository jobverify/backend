import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SODEXO_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SODEXO_INDIA_CATALOG.source
export const COMPANY = SODEXO_INDIA_CATALOG.companyName
export const CAREERS_URL = SODEXO_INDIA_CATALOG.companyCareerPage
export const ACCESS_HR_ROOT_URL = 'https://accesshr.in.sodexo.com/'
export const ACCESS_HR_JOBS_URL = SODEXO_INDIA_CATALOG.accessHrJobsUrl
export const VERIFIED_AT = SODEXO_INDIA_CATALOG.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i
const PUBLIC_JOB_SIGNAL_PATTERN = /current openings|search jobs|job openings|open positions|apply now|job detail|jobview/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
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
      url: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (isTimeoutError(error)) {
      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    }

    const cause = String(error?.cause ?? error?.message ?? error)
    if (/ENOTFOUND|getaddrinfo/i.test(cause)) {
      return {
        status: null,
        url,
        html: null,
        errorKind: 'dns',
      }
    }

    return {
      status: null,
      url,
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Join Our Team \| Careers at Sodexo India/i.test(rawHtml)
    && /We care about amazing people, like you/i.test(normalized)
    && /Take your next step with us/i.test(normalized)
    && /Join Our Team/i.test(normalized)
}

export const extractAccessHrJobsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const candidateUrl = new URL(match[1], CAREERS_URL).toString()
      if (candidateUrl.includes('accesshr.in.sodexo.com')) {
        return candidateUrl
      }
    } catch {
      continue
    }
  }

  return null
}

export const hasAccessHrLoginShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  const hasLegacyLoginShell = /AccessHr/i.test(rawHtml)
    && /Log In/i.test(normalized)
    && /Please choose the connection mode that suits you\./i.test(normalized)
    && /I have a Sodexo Email Address/i.test(normalized)
    && /I do not have a Sodexo Email Address/i.test(normalized)
    && /Powered by mObilise|Powered by mObilise/i.test(rawHtml)

  const hasJavaScriptAppShell = /<title>\s*AccessHr\s*<\/title>/i.test(rawHtml)
    && /<base href="https:\/\/accesshr\.in\.sodexo\.com\/">/i.test(rawHtml)
    && /<app-root><\/app-root>/i.test(rawHtml)
    && /main\.[^"']+\.js/i.test(rawHtml)
    && /assets\/img\/favicon\.ico/i.test(rawHtml)

  return hasLegacyLoginShell || hasJavaScriptAppShell
}

export const hasUnexpectedPublicJobSurface = (surface = {}) =>
  Number(surface?.status) === 200
  && PUBLIC_JOB_SIGNAL_PATTERN.test(normalizeWhitespace(surface?.html))
  && !hasAccessHrLoginShellSignal(surface?.html)

export const createSodexoIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Sodexo India verified first-party careers page no longer matches the trusted public surface')
    }

    const accessHrJobsUrl = extractAccessHrJobsUrl(careersPage.html)
    if (accessHrJobsUrl !== ACCESS_HR_JOBS_URL) {
      throw new Error('Sodexo India verified AccessHr jobs handoff no longer matches the trusted public surface')
    }

    const accessHrSurface = await fetchPage(ACCESS_HR_ROOT_URL)
    if (isExpectedTimedOutSurface(accessHrSurface)) {
      return []
    }

    if (
      Number(accessHrSurface.status) === 200
      && hasAccessHrLoginShellSignal(accessHrSurface.html)
      && !hasUnexpectedPublicJobSurface(accessHrSurface)
    ) {
      return []
    }

    if (hasUnexpectedPublicJobSurface(accessHrSurface)) {
      throw new Error('Sodexo India public AccessHr jobs surface no longer matches the verified login-or-timeout state')
    }

    throw new Error('Sodexo India AccessHr surface no longer matches the verified login-or-timeout state')
  },
})

export const run = async (options = {}) => createSodexoIndiaScraper().run(options)

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
