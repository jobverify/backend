import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PARKED_ROUTE_URLS = [
  'https://availfinance.com/',
  'https://availfinance.com/careers',
  'https://availfinance.com/jobs',
  'https://availfinance.com/robots.txt',
]

export const UNRESOLVED_DOMAIN_URLS = [
  'https://availfinance.in/',
  'https://www.availfinance.in/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bapply now\b/i,
  /\bjob openings?\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
]

const DNS_RESOLUTION_FAILURE_PATTERNS = [
  /\bgetaddrinfo\s+enotfound\b/i,
  /\benotfound\b/i,
  /\bthe remote name could not be resolved\b/i,
  /\bname or service not known\b/i,
  /\bnxdomain\b/i,
]

const TLS_UNAVAILABLE_PATTERNS = [
  /\bself[-\s]signed certificate\b/i,
  /\bcertificate has expired\b/i,
  /\bunable to verify the first certificate\b/i,
  /\bcert_has_expired\b/i,
  /\bdepth_zero_self_signed_cert\b/i,
]

const defaultFetchPage = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,text/plain',
      },
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
      status: hasUnavailableTlsFailure(errorMessage) ? 'TLS_ERROR' : 'DNS_ERROR',
      url,
      html: '',
      errorMessage,
    }
  }
}

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasDnsResolutionFailure = (value) =>
  DNS_RESOLUTION_FAILURE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasUnavailableTlsFailure = (value) =>
  TLS_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasVerifiedParkedSurface = (html = '') => {
  const page = String(html ?? '')

  return page.includes('sedoparking.com')
    && page.includes('yoursupportservices.co.uk')
}

export const createAvailFinanceScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of PARKED_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Avail Finance parked route now appears to expose public jobs: ${url}`)
      }

      const isVerifiedUnavailableHost =
        String(page.status) === 'TLS_ERROR' && hasUnavailableTlsFailure(page.errorMessage)

      if (!isVerifiedUnavailableHost && (Number(page.status) !== 200 || !hasVerifiedParkedSurface(page.html))) {
        throw new Error(`Avail Finance verified parked route changed: ${url}`)
      }
    }

    for (const url of UNRESOLVED_DOMAIN_URLS) {
      const page = await fetchPage(url)

      if (String(page.status) !== 'DNS_ERROR' || !hasDnsResolutionFailure(page.errorMessage)) {
        throw new Error(`Avail Finance verified unresolved first-party surface changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAvailFinanceScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'availfinance')
  }
}
