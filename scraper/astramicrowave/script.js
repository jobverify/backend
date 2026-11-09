import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { ASTRA_MICROWAVE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ASTRA_MICROWAVE_CATALOG.source
export const COMPANY = ASTRA_MICROWAVE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ASTRA_MICROWAVE_CATALOG.officialBrandName
export const VERIFIED_ON = ASTRA_MICROWAVE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ASTRA_MICROWAVE_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ASTRA_MICROWAVE_CATALOG
export const HOMEPAGE_URL = ASTRA_MICROWAVE_CATALOG.homepageUrl
export const CAREERS_URL = ASTRA_MICROWAVE_CATALOG.companyCareerPage
export const CAREERS_ALIAS_URL = ASTRA_MICROWAVE_CATALOG.careersAliasUrl
export const ROBOTS_URL = ASTRA_MICROWAVE_CATALOG.robotsTxtUrl
export const SITEMAP_INDEX_URL = ASTRA_MICROWAVE_CATALOG.sitemapIndexUrl
export const PAGE_SITEMAP_URL = ASTRA_MICROWAVE_CATALOG.pageSitemapUrl
export const APPLICATION_EMAIL = ASTRA_MICROWAVE_CATALOG.applicationEmail
export const APPLICATION_URL = ASTRA_MICROWAVE_CATALOG.applicationUrl
export const BLOCKED_JOB_ROUTE_URLS = ASTRA_MICROWAVE_CATALOG.blockedJobRouteUrls
export const MISSING_JOB_ROUTE_URLS = ASTRA_MICROWAVE_CATALOG.missingJobRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIREWALL_TITLE_PATTERN = /<title>\s*GoDaddy Security\s*-\s*Access Denied\s*<\/title>/i
const PAGE_NOT_FOUND_TITLE_PATTERN = /<title>\s*Page not found\s*(?:&#8211;|&ndash;|â€“|-)\s*Astra Microwave Products Ltd\.\s*<\/title>/i
const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bview details\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /icims/i,
  /ashbyhq\.com/i,
  /darwinbox/i,
]
const REQUIRED_SITEMAP_INDEX_URLS = [
  'https://astramwp.com/wp-sitemap-posts-post-1.xml',
  'https://astramwp.com/wp-sitemap-posts-page-1.xml',
  'https://astramwp.com/wp-sitemap-posts-product-1.xml',
  'https://astramwp.com/wp-sitemap-users-1.xml',
]
const REQUIRED_PAGE_SITEMAP_URLS = [
  'https://astramwp.com/',
  'https://astramwp.com/contact-us/',
  'https://astramwp.com/about-ampl/',
  'https://astramwp.com/our-culture/',
  'https://astramwp.com/learning-development/',
  'https://astramwp.com/post-resume/',
  'https://astramwp.com/post-resume-2/',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
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

const extractLocUrls = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)

const hasOnlyOfficialSitemapHosts = (urls) =>
  urls.every((value) => {
    try {
      return new URL(value).hostname.toLowerCase() === 'astramwp.com'
    } catch {
      return false
    }
  })

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isGoDaddyFirewallBlockedPage = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page.status) === 403
    && FIREWALL_TITLE_PATTERN.test(html)
    && normalized.includes('Access Denied - GoDaddy Website Firewall')
    && normalized.includes('DDOS22')
    && normalized.includes('DDOS attempt was blocked.')
    && !pageExposesPublicJobListings(html)
}

export const isSucuriJavascriptGatePage = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  // A denial is evidence of missing coverage. Its opaque program is neither
  // source data nor something this read-only scraper should interpret.
  return Number(page.status) === 307
    && /<title>\s*You are being redirected\.\.\.\s*<\/title>/i.test(html)
    && normalized.includes('Javascript is required. Please enable javascript before you are allowed to see this page.')
    && !pageExposesPublicJobListings(html)
}

const isKnownBlockedOrGatedPage = (page = {}) =>
  isGoDaddyFirewallBlockedPage(page) || isSucuriJavascriptGatePage(page)

export const hasOfficialRobotsTxtSignal = (text = '') => {
  const normalized = String(text ?? '').replace(/\r/g, '')

  return normalized.includes('User-agent: *')
    && normalized.includes('Disallow: /wp-admin/')
    && normalized.includes('Allow: /wp-admin/admin-ajax.php')
    && normalized.includes(`Sitemap: ${SITEMAP_INDEX_URL}`)
    && !pageExposesPublicJobListings(normalized)
}

export const hasOfficialSitemapIndexSignal = (xml = '') => {
  const urls = extractLocUrls(xml)
  const normalizedUrls = new Set(urls.map((value) => normalizeUrl(value)))

  return REQUIRED_SITEMAP_INDEX_URLS.every((value) => normalizedUrls.has(normalizeUrl(value)))
    && hasOnlyOfficialSitemapHosts(urls)
    && !pageExposesPublicJobListings(xml)
}

export const hasOfficialPageSitemapSignal = (xml = '') => {
  const urls = extractLocUrls(xml)
  const normalizedUrls = new Set(urls.map((value) => normalizeUrl(value)))
  const careerLikeUrls = urls.filter((value) => /(?:post-resume|career|careers|jobs|openings|join-us|work-with-us)/i.test(value))

  return REQUIRED_PAGE_SITEMAP_URLS.every((value) => normalizedUrls.has(normalizeUrl(value)))
    && hasOnlyOfficialSitemapHosts(urls)
    && careerLikeUrls.every((value) => normalizedUrls.has(normalizeUrl(value)))
    && !pageExposesPublicJobListings(xml)
}

export const hasResumeOnlyCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasResumeUploadField =
    /<input\b[^>]*type=["']file["'][^>]*>/i.test(page)
    && /accept=["'][^"']*\.pdf[^"']*["']/i.test(page)

  return /<title>\s*Post Resume\s*(?:&#8211;|&ndash;|â€“|-)\s*Astra Microwave Products Ltd\.\s*<\/title>/i.test(page)
    && normalized.includes('Post Your Resume')
    && normalized.includes('Complete the Form Below and Get Started Today!')
    && normalized.includes('Our Culture')
    && normalized.includes('Learning & Development')
    && normalized.includes('Post Resume')
    && normalized.includes(APPLICATION_EMAIL)
    && /placeholder=["']Name["']/i.test(page)
    && /placeholder=["']E-Mail["']/i.test(page)
    && /placeholder=["']Mobile["']/i.test(page)
    && /placeholder=["']Education["']/i.test(page)
    && hasResumeUploadField
    && /<input\b[^>]*type=["']submit["'][^>]*value=["']Submit["'][^>]*>/i.test(page)
    && !pageExposesPublicJobListings(page)
}

export const isBlockedJobRoute = (page = {}) =>
  BLOCKED_JOB_ROUTE_URLS.includes(String(page.url ?? ''))
  && isKnownBlockedOrGatedPage(page)

export const isMissingJobRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  if (
    MISSING_JOB_ROUTE_URLS.includes(String(page.url ?? ''))
    && isSucuriJavascriptGatePage(page)
  ) {
    return true
  }

  return Number(page.status) === 404
    && MISSING_JOB_ROUTE_URLS.includes(String(page.url ?? ''))
    && PAGE_NOT_FOUND_TITLE_PATTERN.test(html)
    && normalized.includes('Page not found')
    && normalized.includes(APPLICATION_EMAIL)
    && !pageExposesPublicJobListings(html)
}

const getClient = (url) => (url.startsWith('https:') ? https : http)

const rawRequest = (url, { signal } = {}) =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted()
    const client = getClient(url)
    const request = client.request(url, {
      method: 'GET',
      signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'identity',
      },
    }, (response) => {
      const chunks = []
      let bytes = 0

      response.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes > 5000000) {
          response.destroy(new Error('Astra Microwave response exceeds byte bound'))
          return
        }
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      response.on('error', reject)
      response.on('end', () => {
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })

    request.setTimeout(30000, () => {
      request.destroy(new Error(`Timed out while requesting ${url}`))
    })
    request.on('error', reject)
    request.end()
  })

const fetchOfficialPage = async (url, options) => {
  let currentUrl = url
  let redirects = 0

  while (redirects <= 8) {
    const response = await rawRequest(currentUrl, options)

    const gatedPage = { status: response.status, url: currentUrl, html: response.body }
    if (isSucuriJavascriptGatePage(gatedPage)) {
      return gatedPage
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.location
      if (!locationHeader) {
        return { status: response.status, url: currentUrl, html: response.body }
      }

      const next = new URL(locationHeader, currentUrl)
      if (next.protocol !== 'https:' || !['astramwp.com', 'www.astramwp.com'].includes(next.hostname) || next.username || next.password) {
        throw new Error('Astra Microwave redirect left the official HTTPS surface')
      }
      currentUrl = next.href
      redirects += 1
      continue
    }

    return {
      status: response.status,
      url: currentUrl,
      html: response.body,
    }
  }

  throw new Error(`Too many redirects while requesting Astra Microwave URL: ${url}`)
}

const defaultFetchPage = async (url, options) => fetchOfficialPage(url, options)

const hasResumeOnlyOrGatedCareersSignal = (page = {}) => (
  Number(page.status) === 200
  && !pageExposesPublicJobListings(page.html)
  && hasResumeOnlyCareersSignal(page.html)
) || isSucuriJavascriptGatePage(page)

export const createAstraMicrowaveScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal } = {}) {
    const receipts = []
    let resumeObserved = false
    const evidence = () => normalizeInventoryEvidence({ status: 'coverage-gap', firstParty: resumeObserved,
      listingComplete: false, surface: CAREERS_URL, pagesFetched: receipts.length, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: 'Astra Microwave public hiring routes are gated or resume-only; vacancy inventory is unverified' })
    const read = async url => {
      signal?.throwIfAborted()
      let page
      try { page = await fetchPage(url, { signal }) }
      catch (error) { if (signal?.aborted) throw signal.reason; throw error }
      signal?.throwIfAborted()
      receipts.push({ url, responseUrl: page.url, status: page.status })
      return page
    }
    const requireReadable = page => {
      if (isKnownBlockedOrGatedPage(page)) {
        throw Object.assign(new Error('Astra Microwave public crawl resource is blocked or gated'), {
          code: 'ASTRA_MICROWAVE_COVERAGE_GAP', softFailure: true, abortRetries: true,
          failureKind: 'blocked_or_access_denied', status: page.status, statusCode: page.status,
          requestUrl: receipts.at(-1).url, receipts, inventoryEvidence: evidence(), lifecycleCleanupAllowed: false,
        })
      }
    }
    const homepage = await read(HOMEPAGE_URL)
    if (!isKnownBlockedOrGatedPage(homepage)) {
      throw new Error('Astra Microwave homepage no longer matches the verified first-party blocked shell')
    }

    const robots = await read(ROBOTS_URL)
    requireReadable(robots)
    if (robots.status !== 200 || !hasOfficialRobotsTxtSignal(robots.html)) {
      throw new Error('Astra Microwave robots.txt no longer matches the verified first-party crawl surface')
    }

    const sitemapIndex = await read(SITEMAP_INDEX_URL)
    requireReadable(sitemapIndex)
    if (sitemapIndex.status !== 200 || !hasOfficialSitemapIndexSignal(sitemapIndex.html)) {
      throw new Error('Astra Microwave sitemap index no longer matches the verified first-party crawl surface')
    }

    const pageSitemap = await read(PAGE_SITEMAP_URL)
    requireReadable(pageSitemap)
    if (pageSitemap.status !== 200 || !hasOfficialPageSitemapSignal(pageSitemap.html)) {
      throw new Error('Astra Microwave page sitemap no longer matches the verified careers section route set')
    }

    for (const routeUrl of [CAREERS_URL, CAREERS_ALIAS_URL]) {
      const careersPage = await read(routeUrl)
      if (!hasResumeOnlyOrGatedCareersSignal(careersPage)) {
        throw new Error(`Astra Microwave verified resume-only careers page changed materially or now exposes public job listings: ${routeUrl}`)
      }
      resumeObserved ||= careersPage.status === 200
    }

    for (const routeUrl of BLOCKED_JOB_ROUTE_URLS) {
      const routePage = await read(routeUrl)
      if (!isBlockedJobRoute(routePage)) {
        throw new Error(`Astra Microwave blocked job route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    for (const routeUrl of MISSING_JOB_ROUTE_URLS) {
      const routePage = await read(routeUrl)
      if (!isMissingJobRoute(routePage)) {
        throw new Error(`Astra Microwave missing job route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    const jobs = attachInventoryEvidence([], evidence())
    Object.defineProperty(jobs, 'sourceAudit', { value: { complete: false, lifecycleCleanupAllowed: false, receipts,
      reasons: ['Public vacancy inventory unavailable; gated routes and resume forms do not establish zero jobs'] } })
    return jobs
  },
})

export const run = async (options = {}) => createAstraMicrowaveScraper().run(options)

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
