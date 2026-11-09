import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ylogx'
export const COMPANY = 'YlogX'
export const LEGACY_HOMEPAGE_URL = 'https://www.ylogx.co.in/'
export const HOMEPAGE_URL = 'https://ylogx.io/'
export const SITEMAP_URL = 'https://ylogx.io/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://ylogx.io/careers',
  'https://ylogx.io/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REQUIRED_SITEMAP_URLS = [
  'https://ylogx.io/',
  'https://ylogx.io/blogs',
  'https://ylogx.io/casestudies',
  'https://ylogx.io/capabilities',
  'https://ylogx.io/solutions',
  'https://ylogx.io/contact',
  'https://ylogx.io/team',
]

const BUNDLE_REQUIRED_SIGNALS = [
  'YlogX',
  '/api/blogs',
  '/api/blog-list-seo',
  '/api/faq-items',
  '/api/site-settings',
  '/api/chatbot/ask',
]

const JOB_SIGNAL_PATTERNS = [
  /\/careers\b/i,
  /\/career\b/i,
  /\/jobs\b/i,
  /\/join-us\b/i,
  /\/work-with-us\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bapply now\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'ylogx.io' || hostname === 'www.ylogx.co.in' || hostname === 'ylogx.co.in'
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(value)
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/'
    return `${url.origin}${normalizedPath}`.toLowerCase()
  } catch {
    return null
  }
}

export const extractMainBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["'][^>]*><\/script>/i,
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*YlogX\s*-\s*AI-Driven Digital Transformation\s*<\/title>/i.test(page)
    && /<div id=["']root["'][^>]*>[\s\S]*<\/div>/i.test(page)
    && extractMainBundleAssetPath(page) !== null
}

export const hasVerifiedSitemap = (xml) => {
  const source = String(xml ?? '')

  return REQUIRED_SITEMAP_URLS.every((url) => source.includes(url))
    && !/<loc>https:\/\/ylogx\.io\/(?:careers|career|jobs|join-us|work-with-us)<\/loc>/i.test(source)
}

export const hasVerifiedBundleIdentity = (bundleText) => {
  const source = String(bundleText ?? '')

  return BUNDLE_REQUIRED_SIGNALS.every((signal) => source.includes(signal))
    && /path:\s*["']\*["']/i.test(source)
    && /NotFound-[A-Za-z0-9_-]+\.js/i.test(source)
}

export const hasBundleJobsSignal = (bundleText) =>
  JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedRouteFallbackShell = (page = {}, homepageHtml, bundleAssetPath) =>
  Number(page.status) === 200
  && isFirstPartyUrl(page.url || HOMEPAGE_URL)
  && hasOfficialHomepageSignal(page.html)
  && extractMainBundleAssetPath(page.html) === bundleAssetPath
  && !hasBundleJobsSignal(page.html)
  && normalizeWhitespace(page.html) === normalizeWhitespace(homepageHtml)

export const createYlogxScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(LEGACY_HOMEPAGE_URL)

    if (
      homepage.status !== 200
      || normalizeComparableUrl(homepage.url) !== normalizeComparableUrl(HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Response is not the verified official homepage for YlogX')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (sitemapPage.status !== 200 || !hasVerifiedSitemap(sitemapPage.html)) {
      throw new Error('Response is not the verified sitemap for YlogX')
    }

    const bundleAssetPath = extractMainBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('YlogX homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundlePage = await fetchPage(bundleUrl)
    if (
      bundlePage.status !== 200
      || !hasVerifiedBundleIdentity(bundlePage.html)
      || hasBundleJobsSignal(bundlePage.html)
    ) {
      throw new Error('YlogX client bundle changed materially or now exposes a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedRouteFallbackShell(routePage, homepage.html, bundleAssetPath)) {
        throw new Error('YlogX checked first-party routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createYlogxScraper().run(options)

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
