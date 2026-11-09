import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'manycontradingandcontracting'
export const COMPANY = 'Manycon Trading and Contracting'
export const VERIFIED_AT = '2026-07-13'

export const HOMEPAGE_URL = 'https://manycon.com/'
export const ABOUT_URL = 'https://manycon.com/about/'
export const SITEMAP_INDEX_URL = 'https://manycon.com/sitemap_index.xml'
export const PAGE_SITEMAP_URL = 'https://manycon.com/page-sitemap.xml'
export const MISSING_ROUTE_URLS = [
  'https://manycon.com/careers',
  'https://manycon.com/careers/',
  'https://manycon.com/career',
  'https://manycon.com/career/',
  'https://manycon.com/jobs',
  'https://manycon.com/jobs/',
  'https://manycon.com/join-us',
  'https://manycon.com/join-us/',
  'https://manycon.com/work-with-us',
  'https://manycon.com/vacancies',
  'https://manycon.com/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ZERO_CAREERS_PATTERN = /\b(careers?|jobs?|vacanc(?:y|ies)|current openings|join us|work with us)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;|[\u2018\u2019]|â€™/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeLower = (value) => normalizeWhitespace(value).toLowerCase()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const fetchPageWithStatus = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
  signal,
} = {}) => {
  signal?.throwIfAborted()
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: signal ? AbortSignal.any([signal, createTimeoutSignal(timeoutMs)].filter(Boolean)) : createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

const defaultFetchPage = (url, options) => fetchPageWithStatus(url, options)

const hasUnexpectedCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)

  return ZERO_CAREERS_PATTERN.test(text)
    || /href=["']https:\/\/manycon\.com\/(?:careers?|jobs|join-us|work-with-us|vacancies|current-openings)\/?["']/i.test(page)
    || /<loc>https:\/\/manycon\.com\/(?:careers?|jobs|join-us|work-with-us|vacancies|current-openings)\/?<\/loc>/i.test(page)
}

const hasUnexpectedJobsContent = (html) => {
  const text = normalizeLower(html)

  return /\b(apply now|open positions|job openings|submit resume|send your cv|career search)\b/i.test(text)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)

  return /<title>\s*(?:Home - Manycon India \| Expert Fire Protection, Coatings &amp; Construction Services|Fireproofing and Firestop in Qatar and Saudi Arabia)\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/manycon\.com\/"\s*\/?>/i.test(page)
    && text.includes('welcome to manycon')
    && (
      text.includes('qatar & saudi arabia leading fireproofing services')
      || text.includes('manycon delivers qcdd-certified passive firestopping')
    )
    && text.includes("qatar & saudi arabia's qcdd-approved certified experts")
    && text.includes("proudly serving qatar's & saudi arabia's top companies and organizations")
    && /href=["']https:\/\/manycon\.com\/about\/["']/i.test(page)
    && /href=["']https:\/\/manycon\.com\/contact\/["']/i.test(page)
    && /href=["']https:\/\/manycon\.com\/fireproofing-services\/["']/i.test(page)
    && /href=["']https:\/\/manycon\.com\/construction-solutions\/["']/i.test(page)
    && !hasUnexpectedCareersSignal(page)
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)
  const hasLegacyAboutSummary = text.includes('mega manycon brings unmatched regional experience to every project')
    && /completed(?:\s+\d+\+?)?\s+major commercial and industrial projects\s+(?:in|across)\s+qatar and saudi arabia/.test(text)
  const hasCurrentAboutSummary = text.includes('building trust, delivering certified fire safety across qatar & saudi arabia')
    && text.includes('mega manycon')
    && text.includes('most trusted passive fire protection and firestop contractor')

  return /<title>\s*(?:About Us - Manycon India \| Expert Fire Protection, Coatings &amp; Construction Services|About Manycon \| Saudi Arabian and Qatari Fire Safety)\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/manycon\.com\/about\/"\s*\/?>/i.test(page)
    && text.includes('3,200+ firestop projects in qatar | 100+ in saudi arabia')
    && (hasLegacyAboutSummary || hasCurrentAboutSummary)
    && !hasUnexpectedCareersSignal(page)
}

export const hasOfficialSitemapIndexSignal = (xml) => {
  const sitemap = String(xml ?? '')

  return /<loc><!\[CDATA\[https:\/\/manycon\.com\/post-sitemap\.xml\]\]><\/loc>/i.test(sitemap)
    && /<loc><!\[CDATA\[https:\/\/manycon\.com\/page-sitemap\.xml\]\]><\/loc>/i.test(sitemap)
    && /<loc><!\[CDATA\[https:\/\/manycon\.com\/category-sitemap\.xml\]\]><\/loc>/i.test(sitemap)
    && !hasUnexpectedCareersSignal(sitemap)
}

export const hasOfficialPageSitemapSignal = (xml) => {
  const sitemap = String(xml ?? '')

  return /<loc>(?:<!\[CDATA\[)?https:\/\/manycon\.com\/(?:\]\]>)?<\/loc>/i.test(sitemap)
    && /<loc>(?:<!\[CDATA\[)?https:\/\/manycon\.com\/about\/(?:\]\]>)?<\/loc>/i.test(sitemap)
    && /<loc>(?:<!\[CDATA\[)?https:\/\/manycon\.com\/contact\/(?:\]\]>)?<\/loc>/i.test(sitemap)
    && /<loc>(?:<!\[CDATA\[)?https:\/\/manycon\.com\/fireproofing-services\/(?:\]\]>)?<\/loc>/i.test(sitemap)
    && /<loc>(?:<!\[CDATA\[)?https:\/\/manycon\.com\/construction-solutions\/(?:\]\]>)?<\/loc>/i.test(sitemap)
    && !hasUnexpectedCareersSignal(sitemap)
}

const isVerifiedMissingRouteWithLegacyTitle = ({ status, html }) => {
  const page = String(html ?? '')
  const text = normalizeLower(page)
  const hasLegacy404Copy = text.includes("oops! that page can't be found")
    && text.includes('it looks like nothing was found at this location')
  const hasCurrent404Copy = text.includes('oops! page not found')
    && text.includes('slipped through a time portal')
    && text.includes('journey back to our homepage')

  return status === 404
    && /<title>\s*Page not found\s*(?:&#8211;|&ndash;|–|-)\s*Manycon India \| Expert Fire Protection, Coatings &amp; Construction Services\s*<\/title>/i.test(page)
    && (hasLegacy404Copy || hasCurrent404Copy)
    && !hasUnexpectedJobsContent(page)
}

export const isVerifiedMissingRoute = (page = {}) => isVerifiedMissingRouteWithLegacyTitle({
  ...page,
  html: String(page.html ?? '').replace(
    'Manycon | Expert Fire Protection, Coatings &amp; Construction Services',
    'Manycon India | Expert Fire Protection, Coatings &amp; Construction Services',
  ),
})

export const createManyconTradingAndContractingScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    const read = async url => { signal?.throwIfAborted(); const value = await fetchPage(url, { signal }); signal?.throwIfAborted(); return value }
    const homepage = await read(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Manycon Trading and Contracting verified homepage no longer matches the known first-party surface')
    }

    const aboutPage = await read(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Manycon Trading and Contracting verified about page no longer matches the known first-party surface')
    }

    const sitemapIndex = await read(SITEMAP_INDEX_URL)
    if (sitemapIndex.status !== 200 || !hasOfficialSitemapIndexSignal(sitemapIndex.html)) {
      throw new Error('Manycon Trading and Contracting verified sitemap index no longer matches the known first-party surface')
    }

    const pageSitemap = await read(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !hasOfficialPageSitemapSignal(pageSitemap.html)) {
      throw new Error('Manycon Trading and Contracting verified page sitemap no longer matches the known first-party surface')
    }

    for (const url of MISSING_ROUTE_URLS) {
      const page = await read(url)
      if (!isVerifiedMissingRoute(page)) {
        throw new Error(`Manycon Trading and Contracting missing-route validation failed for ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createManyconTradingAndContractingScraper().run(options)

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
