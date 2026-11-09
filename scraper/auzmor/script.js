import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AUZMOR_CATALOG } from './catalog.js'
import { hasCurrentWidget, readCurrentJobs } from './nativeJobs.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AUZMOR_CATALOG.source
export const COMPANY = AUZMOR_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AUZMOR_CATALOG.officialBrandName
export const VERIFIED_ON = AUZMOR_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AUZMOR_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AUZMOR_CATALOG
export const HOMEPAGE_URL = AUZMOR_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = AUZMOR_CATALOG.careersPageUrl
export const PAGE_SITEMAP_URL = AUZMOR_CATALOG.pageSitemapUrl
export const SITEMAP_CAREER_ROUTE_URLS = AUZMOR_CATALOG.sitemapCareerRouteUrls
export const CAREER_ALIAS_ROUTE_URLS = AUZMOR_CATALOG.careerAliasRouteUrls
export const NO_PUBLIC_JOB_ROUTE_URLS = AUZMOR_CATALOG.noPublicJobRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const KNOWN_SITEMAP_CAREER_ROUTES = new Set(
  SITEMAP_CAREER_ROUTE_URLS.map((value) => normalizeUrl(value)),
)
const KNOWN_CAREER_ROUTES = new Set(
  [CAREERS_PAGE_URL, ...CAREER_ALIAS_ROUTE_URLS].map((value) => normalizeUrl(value)),
)

function normalizeWhitespace(value) {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value ?? ''), CAREERS_PAGE_URL)
    url.hash = ''

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    return url.toString().toLowerCase()
  } catch {
    return String(value ?? '')
      .trim()
      .replace(/\/+$/, '')
      .toLowerCase()
  }
}

const hasKnownAtsSignal = (value) =>
  /boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|greenhouse\.io/i.test(
    value,
  )

const extractHrefs = (html) =>
  [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]).filter(Boolean)

const isSameDomainPublicJobUrl = (href) => {
  try {
    const url = new URL(href, CAREERS_PAGE_URL)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()

    if (hostname !== 'auzmor.com') return false

    const normalized = normalizeUrl(url.toString())
    if (KNOWN_CAREER_ROUTES.has(normalized)) return false

    return /\/(?:careers?|jobs?|join-us|work-with-us|openings|current-openings)(?:\/|$)/i.test(url.pathname)
  } catch {
    return false
  }
}

export const extractPublicJobLinks = (html) =>
  [...new Set(
    extractHrefs(html)
      .filter((href) => hasKnownAtsSignal(href) || isSameDomainPublicJobUrl(href))
      .map((href) => {
        try {
          return new URL(href, CAREERS_PAGE_URL).toString()
        } catch {
          return href
        }
      }),
  )]

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*The Most Intuitive Learning Management System for Modern Teams\s*<\/title>/i.test(page)
    && /href=["']\/careers\/["']/i.test(page)
    && normalized.includes('The Most Intuitive Learning Management System for Modern Teams')
    && normalized.includes('An all-in-one LMS')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Auzmor Hire - Powerfully Integrating Your ATS &(?:amp;|&)\s*Careers Page\s*<\/title>/i.test(
    page,
  )
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/auzmor\.com\/careers\/["']/i.test(page)
    && normalized.includes('Help us shape the future')
    && normalized.includes('Why join Auzmor')
    && normalized.includes('Join an innovative team')
    && normalized.includes('We are hiring')
}

const extractCareerRouteUrlsFromSitemap = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => normalizeUrl(match[1]))
    .filter((url) => /\/(?:careers?|jobs?|join-us|work-with-us|openings|current-openings)(?:\/|$)/i.test(url))

export const hasExpectedCareerRouteSet = (xml) => {
  const routes = extractCareerRouteUrlsFromSitemap(xml)
  const expectedRoutes = [...KNOWN_SITEMAP_CAREER_ROUTES].sort()

  return routes.length === expectedRoutes.length
    && [...routes].sort().every((route, index) => route === expectedRoutes[index])
}

export const hasPublicJobListingSignal = (html) => extractPublicJobLinks(html).length > 0

export const isVerifiedCareerAliasPage = (page = {}) =>
  Number(page.status) === 200
  && normalizeUrl(page.url) === normalizeUrl(CAREERS_PAGE_URL)
  && hasOfficialCareersSignal(page.html)
  && !hasPublicJobListingSignal(page.html)

export const isVerifiedMissingPublicJobRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html) || ''

  return Number(page.status) === 404
    && /<title>\s*Page Not Found - auzmor\s*<\/title>/i.test(html)
    && normalized.includes('Page Not Found')
    && !hasPublicJobListingSignal(html)
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createAuzmorScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, maxJobs, maxPages, now } = {}) {
    signal?.throwIfAborted()
    const homepage = await fetchPage(HOMEPAGE_URL, { signal })
    if (homepage.status !== 200 || homepage.url !== HOMEPAGE_URL || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Auzmor official homepage no longer matches the verified first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL, { signal })
    signal?.throwIfAborted()
    if (careersPage.status === 200 && careersPage.url === CAREERS_PAGE_URL && hasCurrentWidget(careersPage.html)) {
      return readCurrentJobs({ fetchPage, signal, maxJobs, maxPages, now })
    }
    if (!hasOfficialCareersSignal(careersPage.html) || hasPublicJobListingSignal(careersPage.html)) {
      throw new Error('Auzmor careers page no longer matches the verified careers marketing page')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !hasExpectedCareerRouteSet(pageSitemap.html)) {
      throw new Error('Auzmor page sitemap no longer matches the verified career-route set')
    }

    for (const routeUrl of CAREER_ALIAS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedCareerAliasPage(routePage)) {
        throw new Error(`Auzmor career alias route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingPublicJobRoute(routePage)) {
        throw new Error(`Auzmor adjacent job route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAuzmorScraper().run(options)

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
