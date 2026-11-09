import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ASCENT_HEALTH_CATALOG } from './catalog.js'
import { createPublicIntakeScraper } from '../abmknowledgeware/publicIntake.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ASCENT_HEALTH_CATALOG.source
export const COMPANY = ASCENT_HEALTH_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ASCENT_HEALTH_CATALOG.officialBrandName
export const VERIFIED_ON = ASCENT_HEALTH_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ASCENT_HEALTH_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ASCENT_HEALTH_CATALOG
export const HOMEPAGE_URL = ASCENT_HEALTH_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = ASCENT_HEALTH_CATALOG.careersPageUrl
export const SITEMAP_INDEX_URL = ASCENT_HEALTH_CATALOG.sitemapIndexUrl
export const PAGE_SITEMAP_URL = ASCENT_HEALTH_CATALOG.pageSitemapUrl
export const SITEMAP_CAREER_ROUTE_URLS = ASCENT_HEALTH_CATALOG.sitemapCareerRouteUrls
export const CAREER_ALIAS_ROUTE_URLS = ASCENT_HEALTH_CATALOG.careerAliasRouteUrls
export const NO_PUBLIC_JOB_ROUTE_URLS = ASCENT_HEALTH_CATALOG.noPublicJobRouteUrls

const KNOWN_CAREER_ROUTES = new Set(
  [CAREERS_PAGE_URL, ...CAREER_ALIAS_ROUTE_URLS].map((value) => normalizeUrl(value)),
)
const KNOWN_SITEMAP_CAREER_ROUTES = new Set(
  SITEMAP_CAREER_ROUTE_URLS.map((value) => normalizeUrl(value)),
)

function normalizeWhitespace(value) {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|\u2018|\u2019/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value ?? ''), CAREERS_PAGE_URL)
    url.hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
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
  /boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|icims|taleo|darwinbox|greenhouse\.io|jobs\.jobvite\.com/i.test(
    value,
  )

const extractHrefs = (html) =>
  [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]).filter(Boolean)

const isSameDomainPublicJobUrl = (href) => {
  try {
    const url = new URL(href, CAREERS_PAGE_URL)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()

    if (hostname !== 'ascenthealthcare.com') return false

    const normalized = normalizeUrl(url.toString())
    if (KNOWN_CAREER_ROUTES.has(normalized)) return false

    return /\/(?:careers?|jobs?|job-openings?|current-openings?|open-positions?)(?:\/|$)/i.test(url.pathname)
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

  return /<title>\s*Digitize Revenue Cycle Management\s*-\s*Ascent Health\s*<\/title>/i.test(page)
    && /https:\/\/www\.ascenthealthcare\.com\/careers\//i.test(page)
    && normalized.includes('Join Ascent')
    && normalized.includes('Breaking barriers for Healthcare providers')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Ascent Career\s*-\s*Join Our Team and Step-in to Exciting Career\s*<\/title>/i.test(page)
    && /careers@ascent-group\.com/i.test(page)
    && normalized.includes("Let's rise beyond, together.")
    && normalized.includes('Which Job are you looking for?*')
    && /<textarea[^>]*name=["']your-message["'][^>]*>/i.test(page)
    && normalized.includes('Upload CV/Resume*')
    && normalized.includes('How did you come across this job information?')
}

export const hasExpectedSitemapIndex = (xml) => {
  const sitemapUrls = [...String(xml ?? '').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => normalizeUrl(match[1]))
    .filter(Boolean)

  return sitemapUrls.includes(normalizeUrl(PAGE_SITEMAP_URL))
    && sitemapUrls.every((url) => url.startsWith('https://ascenthealthcare.com/'))
}

const extractCareerRouteUrlsFromSitemap = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => normalizeUrl(match[1]))
    .filter((url) => /\/(?:careers?|jobs?|job-openings?|current-openings?|open-positions?)(?:\/|$)/i.test(url))

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
    && /<title>\s*Page not found\s*-\s*Ascent Health\s*<\/title>/i.test(html)
    && normalized.includes('Page not found')
    && !hasPublicJobListingSignal(html)
}

const CURRENT_INTAKE = {
  source: SOURCE, companyName: COMPANY, homepageUrl: HOMEPAGE_URL, careersUrl: CAREERS_PAGE_URL,
  brand: /\bAscent\b/i, careersHeading: /Let['’]s rise beyond, together\./i,
  intakeKind: 'general-resume-email', intakeEmail: 'careers@ascent-group.com',
}

export const createAscentHealthScraper = () => ({
  async run(options = {}) {
    const injected = options.fetchPage || options.fetchText
    const budgetMs = options.collectionBudgetMs ?? options.timeoutMs ?? 90000
    if (!Number.isSafeInteger(budgetMs) || budgetMs < 1 || budgetMs > 600000) throw new TypeError('Invalid Ascent source deadline')
    if (options.signal != null && !(options.signal instanceof AbortSignal)) throw new TypeError('Invalid Ascent caller signal')
    const deadline = new AbortController()
    const timer = injected ? null : setTimeout(() => deadline.abort(new DOMException('Ascent source deadline exceeded', 'TimeoutError')), budgetMs)
    const signal = injected ? options.signal : AbortSignal.any([deadline.signal, ...(options.signal ? [options.signal] : [])])
    const transport = injected || ((url) => fetchTextWithRetry(url, { label: SOURCE, timeoutMs: 20000,
      signal, includeResponseMetadata: true, headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      } }))
    const fetchPage = async (url, requestOptions) => {
      const page = await transport(url, requestOptions)
      if (page && typeof page === 'object' && Number.isInteger(page.status) && page.status !== 200) {
        throw Object.assign(new Error('Ascent Health public source unavailable (HTTP ' + page.status + ')'), {
          source: SOURCE, status: page.status, abortRetries: true, nativeJobTotal: null, nativeIndiaTotal: null,
          failureKind: [401, 403, 429].includes(page.status) ? 'blocked_or_access_denied' : 'upstream_http_error',
        })
      }
      const html = typeof page === 'string' ? page : page?.html ?? page?.text
      if (typeof html === 'string' && Buffer.byteLength(html) > 2_000_000) throw new Error('Ascent Health public HTML exceeds source bound')
      return page
    }
    try { return await createPublicIntakeScraper(CURRENT_INTAKE).run({
      ...options, signal, fetchPage, collectionBudgetMs: budgetMs,
      now: () => new Date(options.now ? options.now() : Date.now()).toISOString(),
      onAudit: report => options.onAudit?.({ ...report,
        publicPages: report.publicPages.map(({ html: _html, ...receipt }) => receipt),
      }),
    }) } finally { clearTimeout(timer) }
  },
})

export const run = async (options = {}) => createAscentHealthScraper().run(options)

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
