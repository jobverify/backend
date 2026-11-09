import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wttinternationalprivatelimited'
export const COMPANY = 'WTT International Private Limited'
export const VERIFIED_AT = '2026-08-14'
export const PARKED_ROUTE_URLS = [
  'https://wttinternational.com/',
  'https://www.wttinternational.com/',
  'https://wttinternational.com/careers',
  'https://wttinternational.com/careers/',
  'https://wttinternational.com/jobs',
  'https://wttinternational.com/join-us',
  'https://www.wttinternational.com/careers',
]
export const LANDER_URLS = [
  'https://wttinternational.com/lander',
  'https://www.wttinternational.com/lander',
]
export const UNRESOLVED_DOMAIN_URLS = [
  'https://wttinternational.in/',
  'https://www.wttinternational.in/',
  'https://wttinternational.co.in/',
  'https://www.wttinternational.co.in/',
  'https://wttipl.com/',
  'https://www.wttipl.com/',
  'https://wttipl.in/',
  'https://www.wttipl.in/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const DNS_RESOLUTION_FAILURE_PATTERNS = [
  /\bgetaddrinfo\s+enotfound\b/i,
  /\benotfound\b/i,
  /\bthe remote name could not be resolved\b/i,
  /\bname or service not known\b/i,
  /\bnxdomain\b/i,
]

const UNREACHABLE_FIRST_PARTY_PATTERNS = [
  /\bconnect timeout\b/i,
  /\bund_err_connect_timeout\b/i,
  /\betimedout\b/i,
  /\btimed out\b/i,
  /\baborted due to timeout\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(timeoutMs)

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const getExpectedForSaleHost = (url) => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasDnsResolutionFailure = (value) =>
  DNS_RESOLUTION_FAILURE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasUnreachableFirstPartyError = (value) =>
  UNREACHABLE_FIRST_PARTY_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasVerifiedRedirectShell = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /^<!DOCTYPE html><html><head><script>window\.onload=function\(\)\{window\.location\.href="\/lander"\}<\/script><\/head><\/html>$/i.test(page.trim())
    && normalized === ''
}

export const hasVerifiedGoDaddyLanderRedirect = (page = {}, expectedHost = '') => {
  const html = String(page?.html ?? '')
  const normalizedHost = String(expectedHost ?? '').toLowerCase()
  const expectedHref =
    `https://forsale.godaddy.com/forsale/${normalizedHost}?utm_source=TDFS_BINNS&amp;utm_medium=parkedpages&amp;utm_campaign=x_corp_tdfs-binns_base&amp;traffic_type=TDFS_BINNS&amp;traffic_id=binns&amp;`

  return Number(page?.status) === 307
    && String(page?.url ?? '').toLowerCase().endsWith('/lander')
    && html.includes(expectedHref)
    && /Temporary Redirect/i.test(html)
    && !hasPublicJobsSignal(html)
}

export const isVerifiedUnresolvedFirstPartySurface = (page = {}) => {
  const normalizedText = normalizeWhitespace(page?.html)

  return String(page?.status) === 'DNS_ERROR'
    || (
      String(page?.status) === 'FETCH_ERROR'
      && hasDnsResolutionFailure(page?.errorMessage)
      && normalizedText === ''
    )
}

export const hasVerifiedUnavailableFirstPartySurface = (page = {}) => {
  const normalizedText = normalizeWhitespace(page?.html)

  return normalizedText === ''
    && (
      (
        String(page?.status) === 'FETCH_ERROR'
        && hasUnreachableFirstPartyError(page?.errorMessage)
      )
      || (
        String(page?.status) === 'DNS_ERROR'
        && hasDnsResolutionFailure(page?.errorMessage)
      )
    )
}

const defaultFetchPage = async (url) => {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: createTimeoutSignal(15000),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
      errorMessage: '',
    }
  } catch (error) {
    const errorMessage = String(error?.cause?.message ?? error?.message ?? error)

    return {
      status: hasDnsResolutionFailure(errorMessage) ? 'DNS_ERROR' : 'FETCH_ERROR',
      url,
      html: '',
      errorMessage,
    }
  }
}

export const createWttInternationalPrivateLimitedScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of PARKED_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page?.html)) {
        throw new Error(`WTT International candidate parked route now appears to expose public jobs: ${page?.url || url}`)
      }

      if (hasVerifiedUnavailableFirstPartySurface(page)) {
        continue
      }

      if (Number(page?.status) !== 200 || !hasVerifiedRedirectShell(page?.html)) {
        throw new Error(`WTT International verified parked first-party route changed: ${page?.url || url}`)
      }
    }

    for (const url of LANDER_URLS) {
      const page = await fetchPage(url)

      if (hasVerifiedUnavailableFirstPartySurface(page)) {
        continue
      }

      if (!hasVerifiedGoDaddyLanderRedirect(page, getExpectedForSaleHost(url))) {
        throw new Error(`WTT International verified lander redirect changed: ${page?.url || url}`)
      }
    }

    for (const url of UNRESOLVED_DOMAIN_URLS) {
      const page = await fetchPage(url)

      if (hasVerifiedUnavailableFirstPartySurface(page)) {
        continue
      }

      if (!isVerifiedUnresolvedFirstPartySurface(page)) {
        throw new Error(`WTT International verified unresolved first-party surface changed: ${page?.url || url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createWttInternationalPrivateLimitedScraper().run(options)

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
