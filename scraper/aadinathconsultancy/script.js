import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aadinathconsultancy'
export const COMPANY = 'Aadinath Consultancy'
export const VERIFIED_AT = '2026-08-13'
export const HOMEPAGE_URL = 'https://aadinathconsultants.com/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://aadinathconsultants.com/careers',
  'https://aadinathconsultants.com/careers/',
  'https://aadinathconsultants.com/career',
  'https://aadinathconsultants.com/jobs',
  'https://aadinathconsultants.com/jobs/',
  'https://aadinathconsultants.com/join-us',
  'https://aadinathconsultants.com/work-with-us',
  'https://aadinathconsultants.com/openings',
]
export const FIRST_PARTY_TIMEOUT_URLS = [HOMEPAGE_URL, ...NO_PUBLIC_CAREERS_ROUTE_URLS]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|’)re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions\b/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjobs at\b/i,
  /\bwork with us\b/i,
  /\blever\.co\b/i,
  /\bgreenhouse\.io\b/i,
  /\bashbyhq\.com\b/i,
  /\bworkdayjobs\.com\b/i,
  /\bmyworkdayjobs\.com\b/i,
  /\bsmartrecruiters\.com\b/i,
  /\bjobvite\.com\b/i,
  /\bbreezy\.hr\b/i,
]

const CAREER_ROUTE_LINK_PATTERN =
  /href=["'][^"']*\/(?:careers?|jobs?|join-us|work-with-us|openings)(?:[\/"'?#]|$)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
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

const isExpiredCertificateError = (error) => {
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /CERT_HAS_EXPIRED/i.test(causeCode)
    || /\bcertificate has expired\b/i.test(causeMessage)
    || /\bcertificate has expired\b/i.test(message)
}

const isReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Index of \/\s*<\/title>/i.test(page)
    && /href=["']\/_autoindex\/assets\/css\/autoindex\.css["']/i.test(page)
    && /src=["']\/_autoindex\/assets\/js\/tablesort\.js["']/i.test(page)
    && /src=["']\/_autoindex\/assets\/js\/tablesort\.number\.js["']/i.test(page)
    && /<h1[^>]*>\s*Index of \/\s*<\/h1>/i.test(page)
    && /Proudly Served by LiteSpeed Web Server at aadinathconsultants\.com Port (?:80|443)/i.test(text)
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasCareerRouteLinkSignal = (html = '') =>
  CAREER_ROUTE_LINK_PATTERN.test(String(html ?? ''))

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeWhitespace(html)

  return Number(page?.status) === 404
    && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
    && text.includes('The resource requested could not be found on this server!')
    && text.includes('Proudly powered by LiteSpeed Web Server')
    && text.includes('Please be advised that LiteSpeed Technologies Inc. is not a web hosting company')
    && !hasPublicJobsSignal(html)
}

export const createFetchPage = ({ fetchImpl = fetch } = {}) => async (url) => {
  const fetchResponse = async (targetUrl) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      return await fetchImpl(targetUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  let response

  try {
    response = await fetchResponse(url)
  } catch (error) {
    if (isExpiredCertificateError(error) && new URL(url).protocol === 'https:') {
      const fallbackUrl = new URL(url)
      fallbackUrl.protocol = 'http:'

      try {
        response = await fetchResponse(fallbackUrl.href)
      } catch (fallbackError) {
        if (!isTimeoutError(fallbackError)) throw fallbackError

        return {
          status: null,
          url: fallbackUrl.href,
          html: null,
          errorKind: 'timeout',
        }
      }
    } else if (isTimeoutError(error)) {
      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    } else {
      throw error
    }
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
    errorKind: null,
  }
}

const defaultFetchPage = createFetchPage()

export const createAadinathConsultancyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!isExpectedTimedOutSurface(homepage) && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      if (isReachableSurface(homepage) && (hasPublicJobsSignal(homepage.html) || hasCareerRouteLinkSignal(homepage.html))) {
        throw new Error('Aadinath Consultancy homepage now appears to expose a public jobs surface')
      }

      throw new Error('Aadinath Consultancy verified official homepage no longer matches the trusted first-party surface')
    }

    if (isReachableSurface(homepage) && (hasPublicJobsSignal(homepage.html) || hasCareerRouteLinkSignal(homepage.html))) {
      throw new Error('Aadinath Consultancy homepage now appears to expose a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (isExpectedTimedOutSurface(routePage)) continue

      if (!isVerifiedMissingCareerRoute(routePage)) {
        if (isReachableSurface(routePage) && (hasPublicJobsSignal(routePage.html) || hasCareerRouteLinkSignal(routePage.html))) {
          throw new Error(`Aadinath Consultancy homepage now appears to expose a public jobs surface: ${routePage.url || routeUrl}`)
        }

        throw new Error(`Aadinath Consultancy verified no-public-careers surface changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAadinathConsultancyScraper().run(options)

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
