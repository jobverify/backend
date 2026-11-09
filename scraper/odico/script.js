import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'odico'
export const COMPANY = 'Odico'
export const VERIFIED_AT = '2026-07-13'
export const PARKED_ROUTE_URLS = [
  'https://odico.com/',
  'https://odico.com/careers',
  'https://odico.com/jobs',
  'http://www.odico.com/',
  'http://www.odico.com/careers',
]
export const UNRESOLVED_DOMAIN_URLS = [
  'https://odico.dk/',
  'https://www.odico.dk/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bopen roles?\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const DNS_RESOLUTION_FAILURE_PATTERNS = [
  /\bgetaddrinfo\s+enotfound\b/i,
  /\benotfound\b/i,
  /\bthe remote name could not be resolved\b/i,
  /\bname or service not known\b/i,
  /\bnxdomain\b/i,
  /\benodata\b/i,
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

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(timeoutMs)

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const getParkedRouteDomain = (url) => (String(url).includes('www.odico.com') ? 'www.odico.com' : 'odico.com')

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasDnsResolutionFailure = (value) =>
  DNS_RESOLUTION_FAILURE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasVerifiedSedoParkingSignal = (html, domain) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const domainPattern = new RegExp(`domain=${escapeRegExp(domain)}`, 'i')

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    && normalized.includes('Enable JavaScript and cookies to continue')
    && /cZone:\s*['"]sedo\.com['"]/i.test(page)
    && domainPattern.test(page)
    && /origin=sales_lander_15/i.test(page)
}

export const isVerifiedParkedFirstPartySurface = (page = {}, domain) =>
  Number(page?.status) === 403
  && hasVerifiedSedoParkingSignal(page?.html, domain)
  && !hasPublicJobsSignal(page?.html)

export const isVerifiedUnresolvedFirstPartySurface = (page = {}) => {
  const normalizedText = normalizeWhitespace(page?.html)

  return String(page?.status) === 'DNS_ERROR'
    || (
      String(page?.status) === 'FETCH_ERROR'
      && hasDnsResolutionFailure(page?.errorMessage)
      && normalizedText === ''
    )
}

const defaultFetchPage = async (url) => {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
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

export const createOdicoScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of PARKED_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page?.html)) {
        throw new Error(`Odico verified parked public route now appears to expose jobs: ${page?.url || url}`)
      }

      if (!isVerifiedParkedFirstPartySurface(page, getParkedRouteDomain(url))) {
        throw new Error(`Odico verified parked public route changed: ${page?.url || url}`)
      }
    }

    for (const url of UNRESOLVED_DOMAIN_URLS) {
      const page = await fetchPage(url)

      if (!isVerifiedUnresolvedFirstPartySurface(page)) {
        throw new Error(`Odico verified unresolved first-party surface changed: ${page?.url || url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createOdicoScraper().run(options)

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
