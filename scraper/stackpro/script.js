import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'stackpro'
export const COMPANY = 'StackPro'
export const HOMEPAGE_URL = 'https://stackpro.io/'
export const ABOUT_URL = 'https://stackpro.io/about'
export const CONTACT_URL = 'https://stackpro.io/contact'
export const ROBOTS_URL = 'https://stackpro.io/robots.txt'
export const SITEMAP_URL = 'https://stackpro.io/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://stackpro.io/careers',
  'https://stackpro.io/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_BUNDLE_REQUIRED_SIGNALS = [
  'StackPro',
  'StackPro - Complete Business Stack',
  'https://stackpro.io',
  '/support',
  '/contact',
]

const CONTACT_BUNDLE_REQUIRED_SIGNALS = [
  'StackPro',
  'support@stackpro.io',
  'Get in touch with StackPro',
]

const REQUIRED_SITEMAP_URLS = [
  'https://stackpro.io/',
  'https://stackpro.io/features',
  'https://stackpro.io/pricing',
  'https://stackpro.io/support',
  'https://stackpro.io/contact',
  'https://stackpro.io/industries/law-firms',
  'https://stackpro.io/industries/contractors',
  'https://stackpro.io/industries/marketing-agencies',
  'https://stackpro.io/industries/creative-agencies',
  'https://stackpro.io/try',
  'https://stackpro.io/agents/how-it-works',
  'https://stackpro.io/privacy',
  'https://stackpro.io/terms',
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /["'`]\/careers(?:\/|["'`])/i,
  /["'`]\/jobs(?:\/|["'`])/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /bamboohr/i,
  /freshteam/i,
  /darwinbox/i,
  /keka\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/>\s+</g, '><'),
)

const escapeRegExp = (value) => String(value ?? '')
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const trimTrailingSlash = (value) => String(value ?? '').replace(/\/+$/, '')

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'stackpro.io' || hostname === 'www.stackpro.io'
  } catch {
    return false
  }
}

export const computeSha256 = (value) =>
  createHash('sha256').update(normalizeComparableHtml(value)).digest('hex')

export const extractNextDataPage = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i,
  )

  if (!match) {
    return null
  }

  try {
    const payload = JSON.parse(match[1])
    return typeof payload?.page === 'string' ? payload.page : null
  } catch {
    return null
  }
}

export const extractPageBundleAssetPath = (html, routeName) => {
  const normalizedRouteName = routeName === 'index'
    ? 'index'
    : String(routeName ?? '').replace(/^\/+/, '')

  const match = String(html ?? '').match(
    new RegExp(
      `<script[^>]+src=["']([^"']*\\/_next\\/static\\/chunks\\/pages\\/${escapeRegExp(normalizedRouteName)}-[^"']+\\.js)["'][^>]*>`,
      'i',
    ),
  )

  return match?.[1] ?? null
}

const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

export const hasVerifiedHomepageBundleIdentity = (bundleText) =>
  HOMEPAGE_BUNDLE_REQUIRED_SIGNALS.every((signal) => String(bundleText ?? '').includes(signal))

export const hasVerifiedContactBundleIdentity = (bundleText) =>
  CONTACT_BUNDLE_REQUIRED_SIGNALS.every((signal) => String(bundleText ?? '').includes(signal))

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const hasVerifiedRobotsTxt = (text) => {
  const normalized = String(text ?? '')
  return normalized.includes('User-agent: *')
    && normalized.includes('Allow: /')
    && normalized.includes('Disallow: /dashboard')
    && normalized.includes('Disallow: /onboarding')
    && normalized.includes('Disallow: /api/')
    && normalized.includes(`Sitemap: ${SITEMAP_URL}`)
}

export const hasVerifiedSitemap = (xml) => {
  const urls = extractSitemapUrls(xml)
  const comparableUrls = new Set(urls.map((url) => trimTrailingSlash(url)))

  return REQUIRED_SITEMAP_URLS.every((url) => comparableUrls.has(trimTrailingSlash(url)))
    && NO_PUBLIC_CAREERS_ROUTE_URLS.every((url) => !comparableUrls.has(trimTrailingSlash(url)))
}

export const isVerifiedRoutePage = (page = {}, expectedNextPage, routeName) =>
  Number(page.status) === 200
  && isFirstPartyUrl(page.url || HOMEPAGE_URL)
  && extractNextDataPage(page.html) === expectedNextPage
  && extractPageBundleAssetPath(page.html, routeName) !== null

export const isVerifiedMissingCareersRoute = (page = {}, homepageHtml) => {
  const homepageBundlePath = extractPageBundleAssetPath(homepageHtml, 'index')
  const routeBundlePath = extractPageBundleAssetPath(page.html, 'index')

  return Number(page.status) === 404
    && isFirstPartyUrl(page.url || HOMEPAGE_URL)
    && extractNextDataPage(page.html) === '/'
    && homepageBundlePath !== null
    && routeBundlePath === homepageBundlePath
    && computeSha256(page.html) === computeSha256(homepageHtml)
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

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createStackproScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!isVerifiedRoutePage(homepage, '/', 'index')) {
      throw new Error('StackPro verified official homepage no longer matches the known public surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (!isVerifiedRoutePage(aboutPage, '/about', 'about')) {
      throw new Error('StackPro about route no longer matches the verified first-party public surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (!isVerifiedRoutePage(contactPage, '/contact', 'contact')) {
      throw new Error('StackPro contact route no longer matches the verified first-party public surface')
    }

    const [robotsTxt, sitemapXml] = await Promise.all([
      fetchText(ROBOTS_URL),
      fetchText(SITEMAP_URL),
    ])

    if (!hasVerifiedRobotsTxt(robotsTxt)) {
      throw new Error('StackPro robots.txt changed materially or is no longer first-party')
    }

    if (!hasVerifiedSitemap(sitemapXml)) {
      throw new Error('StackPro sitemap changed materially or now lists public careers')
    }

    const homepageBundlePath = extractPageBundleAssetPath(homepage.html, 'index')
    if (!homepageBundlePath) {
      throw new Error('StackPro homepage no longer exposes the verified page bundle')
    }

    const contactBundlePath = extractPageBundleAssetPath(contactPage.html, 'contact')
    if (!contactBundlePath) {
      throw new Error('StackPro contact page no longer exposes the verified page bundle')
    }

    const [homepageBundleText, contactBundleText] = await Promise.all([
      fetchText(new URL(homepageBundlePath, HOMEPAGE_URL).toString()),
      fetchText(new URL(contactBundlePath, HOMEPAGE_URL).toString()),
    ])

    if (!hasVerifiedHomepageBundleIdentity(homepageBundleText) || hasBundleJobsSignal(homepageBundleText)) {
      throw new Error('StackPro homepage bundle changed materially or now exposes public jobs')
    }

    if (!hasVerifiedContactBundleIdentity(contactBundleText) || hasBundleJobsSignal(contactBundleText)) {
      throw new Error('StackPro contact bundle changed materially or now exposes public jobs')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingCareersRoute(routePage, homepage.html)) {
        throw new Error('StackPro checked careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createStackproScraper().run(options)

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
