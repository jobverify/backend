import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AVIOTRON_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AVIOTRON_CATALOG.source
export const COMPANY = AVIOTRON_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AVIOTRON_CATALOG.officialBrandName
export const VERIFIED_ON = AVIOTRON_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AVIOTRON_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AVIOTRON_CATALOG
export const HOMEPAGE_URL = AVIOTRON_CATALOG.homepageUrl
export const ROBOTS_URL = AVIOTRON_CATALOG.robotsTxtUrl
export const SITEMAP_URL = AVIOTRON_CATALOG.sitemapUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = AVIOTRON_CATALOG.noPublicJobRouteUrls
export const UNTRUSTED_JOB_ROUTE_URL = AVIOTRON_CATALOG.untrustedJobRouteUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNAVAILABLE_ERROR_PATTERN =
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to|getaddrinfo|enotfound/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripScriptAndStyle = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const isVerifiedAviotronUnavailableError = (error) => {
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
    if (!isVerifiedAviotronUnavailableError(error)) throw error

    return {
      page: null,
      error,
    }
  }
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'aviotron.com' || hostname === 'www.aviotron.com'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?aviotron\.com)?\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasCareerRouteInContent = (content) =>
  /https?:\/\/(?:www\.)?aviotron\.com\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|<|\?|#|$)/i.test(
    String(content ?? ''),
  )

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*aviotron\.com\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Aviotron["'][^>]*>/i.test(rawHtml)
    && /Go Daddy Website Builder/i.test(rawHtml)
    && normalized.includes('Launching Soon')
    && normalized.includes('Sign up to be the first to get updates.')
    && normalized.includes('Copyright © 2024 Aviotron - All Rights Reserved.')
}

export const hasOfficialRobotsTxtSignal = (content) => {
  const text = String(content ?? '').replace(/\r/g, '')

  return /User-agent:\s*\*/i.test(text)
    && /Disallow:\s*\/404/i.test(text)
    && !hasCareerRouteInContent(text)
}

export const hasOfficialSitemapSignal = (content) => {
  const text = String(content ?? '').trim()
  const routes = [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].trim())

  return (text === 'http://aviotron.com/sitemap.website.xml'
    || JSON.stringify(routes) === JSON.stringify(['http://aviotron.com/sitemap.website.xml']))
    && !hasCareerRouteInContent(text)
}

export const isMissingCareerRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page.status) === 404
    && isOfficialDomainUrl(page.url || HOMEPAGE_URL)
    && /<title>\s*aviotron\.com\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Page Not Found')
    && normalized.includes('We can’t seem to find the page you’re looking for.')
    && normalized.includes('Go To Home Page')
    && !hasPublicJobsSignal(rawHtml)
    && !hasFirstPartyCareerLikeLink(rawHtml)
}

export const createAviotronScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepageResult = await fetchPageSafely(fetchPage, HOMEPAGE_URL)
    const homepage = homepageResult.page
    if (homepage && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Aviotron verified official homepage no longer matches the known public surface')
    }

    if (homepage && hasPublicJobsSignal(homepage.html)) {
      throw new Error('Aviotron homepage now appears to expose public jobs')
    }

    if (homepage && hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Aviotron homepage now exposes a first-party careers or jobs link')
    }

    const robotsResult = await fetchPageSafely(fetchPage, ROBOTS_URL)
    const robotsTxt = robotsResult.page
    if (robotsTxt && hasCareerRouteInContent(robotsTxt.html)) {
      throw new Error('Aviotron robots.txt now advertises a careers or jobs route')
    }
    if (robotsTxt && (robotsTxt.status !== 200 || !hasOfficialRobotsTxtSignal(robotsTxt.html))) {
      throw new Error('Aviotron verified robots.txt surface no longer matches the known public surface')
    }

    const sitemapResult = await fetchPageSafely(fetchPage, SITEMAP_URL)
    const sitemap = sitemapResult.page
    if (sitemap && hasCareerRouteInContent(sitemap.html)) {
      throw new Error('Aviotron sitemap now advertises a careers or jobs route')
    }
    if (sitemap && (sitemap.status !== 200 || !hasOfficialSitemapSignal(sitemap.html))) {
      throw new Error('Aviotron verified sitemap surface no longer matches the known public surface')
    }

    let sawUnavailableSurface = Boolean(
      homepageResult.error
      || robotsResult.error
      || sitemapResult.error,
    )

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routeResult = await fetchPageSafely(fetchPage, routeUrl)
      const routePage = routeResult.page

      if (!routePage) {
        sawUnavailableSurface = true
        continue
      }

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Aviotron verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    if (sawUnavailableSurface) {
      return []
    }

    return []
  },
})

export const run = async (options = {}) => createAviotronScraper().run(options)

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
