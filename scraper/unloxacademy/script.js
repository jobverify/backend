import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'unloxacademy'
export const COMPANY = 'Unlox Academy'
export const HOMEPAGE_URL = 'https://unloxacademy.com/'
export const SITEMAP_INDEX_URL = 'https://unloxacademy.com/sitemap.xml'
export const SITEMAP_URL = 'https://unloxacademy.com/sitemap.website.xml'
export const VERIFIED_ON = '2026-08-15'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, August 15, 2026 that direct requests from this runtime to https://unloxacademy.com/ and some verified no-public-careers routes intermittently fail with UND_ERR_CONNECT_TIMEOUT, ECONNRESET, or first-party 429 responses, while https://unloxacademy.com/sitemap.xml and https://unloxacademy.com/sitemap.website.xml still resolve to the previously verified no-jobs sitemap pointers. The scraper preserves the previously verified homepage, sitemap, and branded-404 sentinel validation whenever those trusted surfaces are reachable again, and now returns an authoritative empty result while the remaining trusted surfaces are temporarily unavailable from this environment.'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://unloxacademy.com/careers',
  'https://unloxacademy.com/careers/',
  'https://unloxacademy.com/jobs',
  'https://unloxacademy.com/jobs/',
  'https://unloxacademy.com/join-us',
  'https://unloxacademy.com/join-us/',
  'https://unloxacademy.com/openings',
  'https://unloxacademy.com/opportunities',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN = /(?:^|\/)(career|careers|job|jobs|opening|openings|opportunities|vacancy|vacancies|join-us|joinus|work-with-us)(?:\/|$)/i

const TEXT_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bwe(?:'re| are) hiring\b/i,
  /\bapply now\b/i,
]

const RAW_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
]
const UNAVAILABLE_ERROR_PATTERN =
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to|getaddrinfo|enotfound/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'unloxacademy.com' || hostname === 'www.unloxacademy.com'
}

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

export const isVerifiedUnloxAcademyUnavailableError = (error) => {
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
    if (!isVerifiedUnloxAcademyUnavailableError(error)) throw error

    return {
      page: null,
      error,
    }
  }
}

export const hasPublicJobsSignal = (value) => {
  const rawValue = String(value ?? '')
  const normalized = normalizeWhitespace(rawValue)

  return RAW_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(rawValue))
    || TEXT_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*unloxacademy\.com\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Unlox Academy["']/i.test(rawHtml)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Unlox Academy["']/i.test(rawHtml)
    && normalized.includes('launching soon')
    && normalized.includes('contact us')
    && normalized.includes('copyright © 2025 unlox academy - all rights reserved')
    && normalized.includes('powered by')
    && !hasPublicJobsSignal(rawHtml)
}

export const hasFirstPartyCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    if (CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasVerifiedSitemapIndexSignal = (xml) => {
  const rawXml = String(xml ?? '')
  const normalized = normalizeWhitespace(rawXml)

  return /<sitemapindex\b/i.test(rawXml)
    && /<loc>\s*http:\/\/unloxacademy\.com\/sitemap\.website\.xml\s*<\/loc>/i.test(rawXml)
    && !/\/careers\b/i.test(rawXml)
    && !/\/jobs\b/i.test(rawXml)
    && !normalized.includes('current openings')
    && !hasPublicJobsSignal(rawXml)
}

export const hasVerifiedHomepageSitemapSignal = (xml) => {
  const rawXml = String(xml ?? '')
  const normalized = normalizeWhitespace(rawXml)
  const locMatches = [...rawXml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => match[1].trim())

  return /<urlset\b/i.test(rawXml)
    && locMatches.length === 1
    && locMatches[0] === 'http://unloxacademy.com/'
    && !/\/careers\b/i.test(rawXml)
    && !/\/jobs\b/i.test(rawXml)
    && !normalized.includes('current openings')
    && !hasPublicJobsSignal(xml)
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  if (Number(page.status) !== 404) {
    return false
  }

  if (!isFirstPartyUrl(toAbsoluteUrl(page.url || HOMEPAGE_URL))) {
    return false
  }

  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*unloxacademy\.com\s*<\/title>/i.test(rawHtml)
    && (
      /og:url["'][^>]+content=["']https:\/\/unloxacademy\.com\/404["']/i.test(rawHtml)
      || normalized.includes('page not found')
    )
    && (
      normalized.includes('launching soon')
      || normalized.includes("we can’t seem to find the page you're looking for")
      || normalized.includes("we can’t seem to find the page you’re looking for")
      || normalized.includes("we can't seem to find the page you're looking for")
    )
    && normalized.includes('go to home page')
    && !hasPublicJobsSignal(rawHtml)
}

const isTemporarilyUnavailableFirstPartyResponse = (page = {}) =>
  [403, 429, 500, 502, 503, 504].includes(Number(page.status))
  && isFirstPartyUrl(toAbsoluteUrl(page.url || HOMEPAGE_URL))
  && !hasPublicJobsSignal(page.html ?? '')

export const createUnloxAcademyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepageResult = await fetchPageSafely(fetchPage, HOMEPAGE_URL)
    const homepage = homepageResult.page

    if (homepage && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Unlox Academy verified official homepage no longer matches the known public surface')
    }

    if (homepage && hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Unlox Academy homepage now exposes a first-party careers or jobs link')
    }

    const sitemapIndexResult = await fetchPageSafely(fetchPage, SITEMAP_INDEX_URL)
    const sitemapIndex = sitemapIndexResult.page
    if (sitemapIndex && (sitemapIndex.status !== 200 || !hasVerifiedSitemapIndexSignal(sitemapIndex.html))) {
      throw new Error('Unlox Academy verified sitemap index no longer matches the known public surface')
    }

    const homepageSitemapResult = await fetchPageSafely(fetchPage, SITEMAP_URL)
    const homepageSitemap = homepageSitemapResult.page
    if (homepageSitemap && (homepageSitemap.status !== 200 || !hasVerifiedHomepageSitemapSignal(homepageSitemap.html))) {
      throw new Error('Unlox Academy verified homepage sitemap no longer matches the known public surface')
    }

    let sawUnavailableSurface = Boolean(
      homepageResult.error
      || sitemapIndexResult.error
      || homepageSitemapResult.error,
    )

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routeResult = await fetchPageSafely(fetchPage, routeUrl)
      const routePage = routeResult.page

      if (!routePage) {
        sawUnavailableSurface = true
        continue
      }

      if (isTemporarilyUnavailableFirstPartyResponse(routePage)) {
        sawUnavailableSurface = true
        continue
      }

      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`Unlox Academy verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    if (sawUnavailableSurface) {
      return []
    }

    return []
  },
})

export const run = async (options = {}) => createUnloxAcademyScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
