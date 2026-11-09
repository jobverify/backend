import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KARNIVAL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = KARNIVAL_CATALOG.source
export const COMPANY = KARNIVAL_CATALOG.companyName
export const VERIFIED_ON = KARNIVAL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = KARNIVAL_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = KARNIVAL_CATALOG
export const HOMEPAGE_URL = KARNIVAL_CATALOG.homepageUrl
export const SITEMAP_URL = KARNIVAL_CATALOG.sitemapUrl
export const MISSING_JOBS_ROUTE_URLS = KARNIVAL_CATALOG.missingJobsRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Customer marketing and smarter receipts for brands\s*<\/title>/i.test(page)
    && /href=["']#solutions["']/i.test(page)
    && /href=["']#success["']/i.test(page)
    && /href=["']\/blogs["']/i.test(page)
    && /href=["']\/contact["']/i.test(page)
    && normalized.includes('Get a demo')
  }

export const hasRenderablePublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /\b(Careers|Join our team|Apply now|Current Openings|Open Positions|Vacancies)\b/i.test(normalized)
    || /href=["'][^"']*\/(careers|jobs)(?:\/|["'])/i.test(page)
    || /jobs\.[a-z0-9.-]+/i.test(page)
    || /JobPosting/i.test(page)
  }

export const extractSitemapUrls = (xml) => {
  const matches = String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)
  return [...matches].map((match) => match[1].trim())
}

const normalizeKarnivalHostname = (hostname) => hostname.replace(/^www\./i, '').toLowerCase()

export const normalizeSitemapUrl = (value) => {
  try {
    const url = new URL(String(value ?? '').trim())
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    return `${url.protocol}//${normalizeKarnivalHostname(url.hostname)}${pathname}`
  } catch {
    return String(value ?? '')
      .trim()
      .replace(/^https?:\/\/www\./i, (prefix) => prefix.replace(/www\./i, ''))
      .replace(/\/+$/, '')
  }
}

export const hasVerifiedSitemapSignal = (xml) => {
  const urls = extractSitemapUrls(xml).map(normalizeSitemapUrl)
  const expectedUrls = [
    'https://karnival.com/',
    'https://karnival.com/contact',
    'https://karnival.com/blogs',
    'https://karnival.com/privacy-policy',
    'https://karnival.com/terms-and-conditions',
  ].map(normalizeSitemapUrl)

  return expectedUrls.every((url) => urls.includes(url))
    && !urls.some((url) => /\/(careers|jobs)(?:\/|$)/i.test(url))
  }

export const isVerifiedMissingJobsRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html) || ''

  return Number(page.status) === 404
    && /<title>\s*Not Found\s*<\/title>/i.test(html)
    && normalized.includes('Oops! 404 Error')
    && normalized.includes('The page you are looking for does not exist.')
    && !hasRenderablePublicJobsSignal(html)
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

export const createKarnivalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Karnival official homepage no longer matches the verified marketing surface')
    }

    if (hasRenderablePublicJobsSignal(homepage.html)) {
      throw new Error('Karnival official homepage now exposes a live public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasVerifiedSitemapSignal(sitemap.html)) {
      throw new Error('Karnival sitemap no longer matches the verified public page inventory')
    }

    for (const routeUrl of MISSING_JOBS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingJobsRoute(routePage)) {
        throw new Error(`Karnival missing first-party jobs route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createKarnivalScraper().run(options)

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
