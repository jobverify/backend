import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'celette'
export const COMPANY = 'Celette'
export const COMPANY_DOMAIN = 'celette.com'
export const VERIFIED_AT = '2026-08-15'
export const HOMEPAGE_URL = 'https://www.celette.com/'
export const CONTACT_US_URL = 'https://www.celette.com/contact-us/'
export const CAREERS_URL = 'https://www.celette.com/careers/'
export const JOBS_URL = 'https://www.celette.com/jobs/'
export const VERIFIED_ROUTE_URLS = [
  HOMEPAGE_URL,
  CONTACT_US_URL,
  CAREERS_URL,
  JOBS_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isTimeoutError = (error) =>
  error?.name === 'AbortError'
  || /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(String(error?.cause?.code ?? ''))
  || /timed out|timeout|connect timeout|und_err_connect_timeout/i.test(String(error?.cause?.message ?? error?.message ?? error ?? ''))

const getHeader = (page, name) => {
  const headers = page?.headers
  if (!headers) return ''

  if (typeof headers.get === 'function') {
    return String(headers.get(name) ?? '')
  }

  const value = headers[name] ?? headers[name.toLowerCase()]
  return String(value ?? '')
}

const buildMaterialSurfaceChangeError = () => {
  const error = new Error('The verified Celette first-party blocked surfaces changed materially')
  error.abortRetries = true
  return error
}

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = typeof page === 'string' ? String(page) : String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)
  const status = typeof page === 'string' ? null : Number(page?.status)

  return (status == null || status === 403)
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && normalized.includes('Enable JavaScript and cookies to continue')
    && /challenges\.cloudflare\.com/i.test(html)
    && /_cf_chl_opt/i.test(html)
    && /celette\.com/i.test(html)
    && (
      typeof page === 'string'
      || (
        /cloudflare/i.test(getHeader(page, 'server'))
        && getHeader(page, 'cf-mitigated').toLowerCase() === 'challenge'
      )
    )
}

export const isVerifiedTimeoutBlockedRoute = (page = {}) => page?.errorKind === 'timeout'

export const hasVerifiedAccessibleSurface = (page = {}, url = page?.url) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  if (page?.status === 404 && (url === CAREERS_URL || url === JOBS_URL)) {
    return normalized.includes('page not found - celette')
      && normalized.includes('collision repair equipment')
  }

  if (page?.status !== 200) return false

  if (url === HOMEPAGE_URL) {
    return normalized.includes('global collision repair equipment supplier')
      && normalized.includes('usa & worldwide')
  }

  if (url === CONTACT_US_URL) {
    return normalized.includes('contact us - celette')
      && normalized.includes('collision repair equipment')
  }

  return false
}

export const exposesStructuredPublicJobs = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('current openings')
    || normalized.includes('open positions')
    || normalized.includes('job openings')
    || normalized.includes('join our team')
    || normalized.includes('browse open roles')
    || /<article[^>]+(?:class|id)=["'][^"']*\bjob(?:[-_\s]|$)[^"']*["']/i.test(page)
    || />\s*Apply now\s*</i.test(page)
}

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      status: response.status,
      url,
      finalUrl: response.url,
      html: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    return {
      status: null,
      url,
      finalUrl: url,
      html: null,
      headers: {},
      errorKind: isTimeoutError(error) ? 'timeout' : 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const createCeletteScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of VERIFIED_ROUTE_URLS) {
      const page = await fetchPage(url)

      if (page.errorKind) {
        if (isVerifiedTimeoutBlockedRoute(page)) {
          continue
        }

        throw new Error(`Failed to fetch verified Celette route: ${url} (${page.errorKind})`)
      }

      if (exposesStructuredPublicJobs(page.html)) {
        throw new Error('Celette blocked first-party routes now expose scraper-visible public jobs')
      }

      if (!hasVerifiedCloudflareChallengeSignal(page) && !hasVerifiedAccessibleSurface(page, url)) {
        throw buildMaterialSurfaceChangeError()
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCeletteScraper().run(options)

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
