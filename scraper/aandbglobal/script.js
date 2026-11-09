import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aandbglobal'
export const COMPANY = 'A&B Global'
export const VERIFIED_AT = '2026-07-14'
export const HOMEPAGE_URL = 'https://aandbglobal.com/'
export const WORK_WITH_US_ANCHOR_URL = 'https://aandbglobal.com/#workwithus'
export const SITEMAP_URL = 'https://aandbglobal.com/wp-sitemap-posts-page-1.xml'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://aandbglobal.com/career/',
  'https://aandbglobal.com/careers/',
  'https://aandbglobal.com/jobs/',
  'https://aandbglobal.com/job-openings/',
  'https://aandbglobal.com/work-with-us/',
  'https://aandbglobal.com/workwithus/',
  'https://aandbglobal.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNAVAILABLE_ERROR_PATTERN =
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to|getaddrinfo|enotfound/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => String(value ?? '')
  .trim()
  .replace(/\/+$/, '')
  .toLowerCase()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'aandbglobal.com' || hostname === 'www.aandbglobal.com'
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*A(?:&amp;|&)\s*B GLOBAL LTD\s*\|\s*One Step Away From Excellence\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*A(?:&amp;|&)\s*B Global Education\s*<\/h1>/i.test(page)
    && /href=["']#workwithus["']/i.test(page)
    && normalized.includes('Welcome to A&B Global')
    && /mailto:admin@aandbglobal\.com/i.test(page)
}

export const hasWorkWithUsPartnerSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Join with Us as A Partner')
    && normalized.includes('Contact our admission counseller and get a free consultation')
    && normalized.includes('Business Name')
    && normalized.includes('Ask us anything...')
}

export const hasPublicJobBoardSignal = (html) => {
  const page = String(html ?? '')

  return /\b(Current Openings|Open Positions|Job Openings|Open Roles|Vacancies)\b/i.test(page)
    || /href=["'][^"']*\/(?:careers?|jobs?|job-openings?)\/[^"']+["']/i.test(page)
}

export const hasSingleHomepageSitemap = (xml = '') => {
  const matches = [...String(xml ?? '').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
  const urls = matches.map((match) => normalizeUrl(match[1])).filter(Boolean)

  return urls.length === 1 && urls[0] === normalizeUrl(HOMEPAGE_URL)
}

export const isVerifiedMissingPublicJobRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page.html)

  return Number(page.status) === 404
    && /<title>\s*404 Not Found\s*\|\s*A(?:&amp;|&)\s*B GLOBAL LTD\s*<\/title>/i.test(String(page.html ?? ''))
    && normalized.includes('No Results Found')
    && !hasPublicJobBoardSignal(page.html)
}

export const isTemporarilyUnavailableFirstPartyResponse = (page = {}) =>
  [403, 429, 500, 502, 503, 504].includes(Number(page.status))
  && isFirstPartyUrl(toAbsoluteUrl(page.url || HOMEPAGE_URL))
  && !hasPublicJobBoardSignal(page.html)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const isAandbGlobalTemporarilyUnavailableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNAVAILABLE_ERROR_PATTERN.test(message)
    || UNAVAILABLE_ERROR_PATTERN.test(causeCode)
    || UNAVAILABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchPageSafely = async (fetchPage, url) => {
  try {
    return {
      page: await fetchPage(url),
      error: null,
    }
  } catch (error) {
    if (!isAandbGlobalTemporarilyUnavailableError(error)) throw error

    return {
      page: null,
      error,
    }
  }
}

export const createAandbGlobalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepageResult = await fetchPageSafely(fetchPage, HOMEPAGE_URL)
    const homepage = homepageResult.page
    let sawUnavailableSurface = Boolean(homepageResult.error)
    let homepageMatchesVerifiedSurface = false

    if (homepage && isTemporarilyUnavailableFirstPartyResponse(homepage)) {
      sawUnavailableSurface = true
    } else if (homepage && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('A&B Global verified official homepage no longer matches the trusted first-party surface')
    } else if (homepage) {
      homepageMatchesVerifiedSurface = true
    }

    if (homepageMatchesVerifiedSurface && !hasWorkWithUsPartnerSignal(homepage.html)) {
      throw new Error('A&B Global homepage no longer exposes the verified Work With Us partner popup')
    }

    if (homepageMatchesVerifiedSurface && hasPublicJobBoardSignal(homepage.html)) {
      throw new Error('A&B Global homepage now exposes a public jobs surface')
    }

    const sitemapResult = await fetchPageSafely(fetchPage, SITEMAP_URL)
    const sitemapPage = sitemapResult.page
    sawUnavailableSurface ||= Boolean(sitemapResult.error)

    if (sitemapPage && isTemporarilyUnavailableFirstPartyResponse(sitemapPage)) {
      sawUnavailableSurface = true
    } else if (sitemapPage && (sitemapPage.status !== 200 || !hasSingleHomepageSitemap(sitemapPage.html))) {
      throw new Error('A&B Global sitemap no longer matches the verified single-homepage first-party surface')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routeResult = await fetchPageSafely(fetchPage, routeUrl)
      const routePage = routeResult.page
      sawUnavailableSurface ||= Boolean(routeResult.error)

      if (!routePage) {
        continue
      }

      if (isTemporarilyUnavailableFirstPartyResponse(routePage)) {
        sawUnavailableSurface = true
        continue
      }

      if (!isVerifiedMissingPublicJobRoute(routePage)) {
        throw new Error(`A&B Global common job route changed materially or now exposes public jobs: ${routePage.url || routeUrl}`)
      }
    }

    if (sawUnavailableSurface) {
      return []
    }

    return []
  },
})

export const run = async (options = {}) => createAandbGlobalScraper().run(options)

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
