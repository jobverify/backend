import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'puntpartners'
export const COMPANY = 'Punt Partners'
export const VERIFIED_AT = '2026-08-04'

export const HOMEPAGE_URL = 'https://punt.partners/'
export const TEAM_URL = 'https://punt.partners/team/'
export const PARTNERS_URL = 'https://punt.partners/partners/'
export const SITEMAP_INDEX_URL = 'https://punt.partners/wp-sitemap.xml'
export const PAGE_SITEMAP_URL = 'https://punt.partners/wp-sitemap-posts-page-1.xml'
export const MISSING_ROUTE_URLS = [
  'https://punt.partners/careers',
  'https://punt.partners/careers/',
  'https://punt.partners/career',
  'https://punt.partners/career/',
  'https://punt.partners/jobs',
  'https://punt.partners/jobs/',
  'https://punt.partners/join-us',
  'https://punt.partners/work-with-us',
  'https://punt.partners/current-openings',
  'https://punt.partners/vacancies',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const TIMEOUT_ERROR_PATTERN =
  /\btimed out\b|\btimeout\b|\bund_err_connect_timeout\b|\betimedout\b|\bcould not connect\b/i
const TLS_ERROR_PATTERN =
  /\bssl\/tls secure channel\b|\btrust relationship\b|\bcertificate\b|\bself[- ]signed\b/i

const KNOWN_SITEMAP_URLS = [
  'https://punt.partners/wp-sitemap-posts-post-1.xml',
  'https://punt.partners/wp-sitemap-posts-page-1.xml',
  'https://punt.partners/wp-sitemap-taxonomies-category-1.xml',
  'https://punt.partners/wp-sitemap-users-1.xml',
]

const KNOWN_PAGE_SITEMAP_URLS = [
  'https://punt.partners/sample-page/',
  'https://punt.partners/',
  'https://punt.partners/team/',
  'https://punt.partners/contact-us/',
  'https://punt.partners/newsroom/',
  'https://punt.partners/test/',
  'https://punt.partners/overview/',
  'https://punt.partners/partners/',
  'https://punt.partners/themartechredpill/',
  'https://punt.partners/landing-page/',
  'https://punt.partners/newsletter/',
]

const CAREERS_TEXT_PATTERN =
  /\b(careers?|jobs?|vacanc(?:y|ies)|current openings|open positions|hiring|apply now|submit resume|send your cv|join us|work with us)\b/i

const CAREERS_ROUTE_PATTERN =
  /https:\/\/punt\.partners\/(?:careers?|jobs|join-us|work-with-us|current-openings|vacancies)\/?/i
const PARTNERS_LINK_PATTERN = /href="https:\/\/punt\.partners\/partners\/?"/i

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&rsquo;|&#39;|&apos;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeLower = (value) => normalizeWhitespace(value).toLowerCase()

const collectLocs = (xml) => [...String(xml ?? '').matchAll(/<loc>(.*?)<\/loc>/gi)]
  .map((match) => normalizeWhitespace(match[1]))

const sameMembers = (actual, expected) => {
  if (actual.length !== expected.length) return false

  const actualSet = new Set(actual)
  if (actualSet.size !== expected.length) return false

  return expected.every((value) => actualSet.has(value))
}

const defaultFetchPage = async (url) =>
  withRetry(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: createTimeoutSignal(15000),
    })

    return {
      status: response.status,
      url: response.url || url,
      html: await response.text(),
      errorKind: null,
    }
  }, {
    attempts: 3,
    baseDelayMs: 2000,
    label: SOURCE,
  }).catch((error) => ({
    status: null,
    url,
    html: null,
    errorKind:
      TLS_ERROR_PATTERN.test(String(error?.message ?? error))
      || TLS_ERROR_PATTERN.test(String(error?.cause?.message ?? ''))
      ? 'tls'
      : (
          TIMEOUT_ERROR_PATTERN.test(String(error?.message ?? error))
          || TIMEOUT_ERROR_PATTERN.test(String(error?.cause?.message ?? ''))
          || TIMEOUT_ERROR_PATTERN.test(String(error?.cause?.code ?? ''))
            ? 'timeout'
            : 'network'
        ),
    errorMessage: String(error?.message ?? error),
  }))

const isExpectedUnavailableSurface = (surface = {}) =>
  ['timeout', 'tls'].includes(surface?.errorKind)
  && !Number.isInteger(surface?.status)
  && surface?.html == null

const hasUnexpectedCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)

  return CAREERS_TEXT_PATTERN.test(text)
    || CAREERS_ROUTE_PATTERN.test(page)
    || /<loc>https:\/\/punt\.partners\/(?:careers?|jobs|join-us|work-with-us|current-openings|vacancies)\/?<\/loc>/i.test(page)
}

const hasUnexpectedJobsContent = (html) => CAREERS_TEXT_PATTERN.test(normalizeLower(html))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)

  return /<title>\s*Punt Partners\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/punt\.partners\/"\s*\/?>/i.test(page)
    && text.includes('enable growth by leveraging tech and creativity')
    && text.includes('punt partners mission is to enable brands to succeed by leveraging technology with creative storytelling')
    && text.includes('shelf radar')
    && text.includes('punt creative')
    && text.includes('fablesai')
    && text.includes('aristok')
    && /href="https:\/\/punt\.partners\/newsroom\/"/i.test(page)
    && /href="https:\/\/punt\.partners\/team\/"/i.test(page)
    && /href="https:\/\/punt\.partners\/partners\/"/i.test(page)
    && /href="https:\/\/punt\.partners\/contact-us\/"/i.test(page)
    && !hasUnexpectedCareersSignal(page)
}

export const hasOfficialTeamSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)

  return /<title>\s*Team(?:\s|&#8211;|-)+Punt Partners\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/punt\.partners\/team\/"\s*\/?>/i.test(page)
    && text.includes('welcome to the exceptional team at punt')
    && text.includes('madhu sudhan')
    && text.includes('priyanka agrawal')
    && text.includes('harsh shah')
    && text.includes('aniket khare')
    && text.includes('kaushal agrawal')
    && text.includes('vishal agarwal')
    && !hasUnexpectedCareersSignal(page)
}

export const hasOfficialPartnersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)

  return /<title>\s*Partners(?:\s|&#8211;|-)+Punt Partners\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/punt\.partners\/partners\/"\s*\/?>/i.test(page)
    && text.includes('our investors')
    && text.includes("punt partners is backed by some of india's most prominent names from the world of media, advertising, marketing and internet")
    && text.includes('aakrit vaish')
    && text.includes('anupam mittal')
    && text.includes('ashish hemrajani')
    && !hasUnexpectedCareersSignal(page)
}

export const hasOfficialSitemapIndexSignal = (xml) => {
  const sitemap = String(xml ?? '')
  const locs = collectLocs(sitemap)

  return sameMembers(locs, KNOWN_SITEMAP_URLS)
    && !hasUnexpectedCareersSignal(sitemap)
}

export const hasOfficialPageSitemapSignal = (xml) => {
  const sitemap = String(xml ?? '')
  const locs = collectLocs(sitemap)

  return sameMembers(locs, KNOWN_PAGE_SITEMAP_URLS)
    && !hasUnexpectedCareersSignal(sitemap)
}

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)

  return status === 404
    && /<title>\s*Page not found(?:\s|&#8211;|-)+Punt Partners\s*<\/title>/i.test(page)
    && text.includes("the page can't be found")
    && text.includes('it looks like nothing was found at this location')
    && /href="https:\/\/punt\.partners\/newsroom\/"/i.test(page)
    && /href="https:\/\/punt\.partners\/team\/"/i.test(page)
    && PARTNERS_LINK_PATTERN.test(page)
    && /href="https:\/\/punt\.partners\/contact-us\/"/i.test(page)
    && !hasUnexpectedJobsContent(page)
}

export const createPuntPartnersScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const [
      homepage,
      teamPage,
      partnersPage,
      sitemapIndex,
      pageSitemap,
    ] = await Promise.all([
      fetchPage(HOMEPAGE_URL),
      fetchPage(TEAM_URL),
      fetchPage(PARTNERS_URL),
      fetchPage(SITEMAP_INDEX_URL),
      fetchPage(PAGE_SITEMAP_URL),
    ])
    const primarySurfaces = [
      { surface: homepage, expectedStatus: 200, validator: hasOfficialHomepageSignal, error: 'Punt Partners verified homepage no longer matches the known first-party surface' },
      { surface: teamPage, expectedStatus: 200, validator: hasOfficialTeamSignal, error: 'Punt Partners verified team page no longer matches the known first-party surface' },
      { surface: partnersPage, expectedStatus: 200, validator: hasOfficialPartnersSignal, error: 'Punt Partners verified partners page no longer matches the known first-party surface' },
      { surface: sitemapIndex, expectedStatus: 200, validator: hasOfficialSitemapIndexSignal, error: 'Punt Partners verified sitemap index no longer matches the known first-party surface' },
      { surface: pageSitemap, expectedStatus: 200, validator: hasOfficialPageSitemapSignal, error: 'Punt Partners verified page sitemap no longer matches the known first-party surface' },
    ]

    let hasVerifiedReachablePrimarySurface = false
    for (const { surface, expectedStatus, validator, error } of primarySurfaces) {
      if (isExpectedUnavailableSurface(surface)) continue
      if (surface.status !== expectedStatus || !validator(surface.html)) {
        throw new Error(error)
      }
      hasVerifiedReachablePrimarySurface = true
    }

    if (!hasVerifiedReachablePrimarySurface) {
      return []
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Punt Partners verified homepage no longer matches the known first-party surface')
    }

    const missingRoutePages = await Promise.all(
      MISSING_ROUTE_URLS.map(async (url) => ({
        url,
        page: await fetchPage(url),
      })),
    )

    for (const { url, page } of missingRoutePages) {
      if (isExpectedUnavailableSurface(page)) continue
      if (!isVerifiedMissingRoute(page)) {
        throw new Error(`Punt Partners missing-route validation failed for ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPuntPartnersScraper().run(options)

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
