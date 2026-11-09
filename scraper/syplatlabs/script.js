import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'syplatlabs'
export const COMPANY = 'SYplat Labs'
export const HOMEPAGE_URL = 'https://www.syplat.com/'
export const REDIRECTED_HOMEPAGE_URL = 'https://www.syplat.com/'
export const CAREERS_ROUTE_URLS = [
  'https://www.syplat.com/careers',
  'https://www.syplat.com/jobs',
]
export const EXPECTED_BUNDLE_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/ecosystem',
  '/engagement',
  '/legal/accessibility',
  '/legal/cookies',
  '/legal/imprint',
  '/legal/privacy',
  '/legal/terms',
  '/platform',
  '/resources',
  '/roadmap',
  '/sy-integration',
  '/synexira',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERNS = [
  /<title>\s*SYplat Labs\s*(?:-|&#8212;|&mdash;|\u2014)\s*The autonomous trust fabric for AI-driven enterprises\s*<\/title>/i,
  /<meta[^>]+name="description"[^>]+semantic security fabric[^>]+SAP Build Partner\.(?:\s*Microsoft AI Cloud Partner\.)?["']/i,
  /<meta[^>]+name="author"[^>]+content="SYplat Labs"/i,
  /<script[^>]+src="\/assets\/index-[^"]+\.js"/i,
  /<div id="root"><\/div>/i,
  />\s*Skip to main content\s*</i,
]

const EXPLICIT_CAREERS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen roles\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bhiring\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bwork with us\b/i,
  /path:"\/careers\b/i,
  /path:"\/jobs\b/i,
  /to:"\/careers\b/i,
  /to:"\/jobs\b/i,
]

const ROUTE_PATTERN = /path:"(\/[^"]*)"/g

const defaultHeaders = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: defaultHeaders,
  })

  return {
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

export const hasOfficialHomepageShellSignal = (html) =>
  HOMEPAGE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const extractBundleUrl = (html, baseUrl = REDIRECTED_HOMEPAGE_URL) => {
  const match = String(html ?? '').match(
    /<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i,
  )

  return match ? new URL(match[1], baseUrl).toString() : null
}

export const extractBundleRoutes = (bundleText) => {
  const routes = new Set()
  const text = String(bundleText ?? '')

  for (const match of text.matchAll(ROUTE_PATTERN)) {
    routes.add(match[1])
  }

  return [...routes].sort((left, right) => left.localeCompare(right))
}

export const hasExplicitCareersSignal = (text) =>
  EXPLICIT_CAREERS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(text ?? '')))

export const hasVerifiedBundleRouteSignal = (bundleText) => {
  const actualRoutes = extractBundleRoutes(bundleText)

  return !hasExplicitCareersSignal(bundleText)
    && actualRoutes.length === EXPECTED_BUNDLE_ROUTES.length
    && actualRoutes.every((route, index) => route === EXPECTED_BUNDLE_ROUTES[index])
}

export const isVerifiedNoPublicJobsRoute = (page) =>
  Number(page?.status) === 200
  && hasOfficialHomepageShellSignal(page?.text)
  && !hasExplicitCareersSignal(page?.text)

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: REDIRECTED_HOMEPAGE_URL,
    alternateCareerPages: CAREERS_ROUTE_URLS,
    adapter: 'script',
    atsPlatform: 'no-public-jobs-surface',
    countryFilter: 'India',
    parser: 'custom-script',
    paginationStrategy: 'none',
    extractionStrategy: 'verified-homepage-shell-plus-bundle-route-map-with-no-public-careers-signal',
    normalizationProfile: 'engineering-default',
    companyDomain: 'syplat.com',
  },
})

export const createSyplatLabsScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage?.status) !== 200
      || !String(homepage?.url ?? '').startsWith(REDIRECTED_HOMEPAGE_URL)
      || !hasOfficialHomepageShellSignal(homepage?.text)
    ) {
      throw new Error('SYplat Labs verified homepage redirect or shell changed')
    }

    const bundleUrl = extractBundleUrl(homepage.text, homepage.url)
    if (!bundleUrl) {
      throw new Error('SYplat Labs homepage no longer exposes the verified first-party application bundle')
    }

    const bundle = await fetchPage(bundleUrl)
    if (Number(bundle?.status) !== 200 || !hasVerifiedBundleRouteSignal(bundle?.text)) {
      throw new Error('SYplat Labs verified bundle route map changed or now exposes public careers')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedNoPublicJobsRoute(routePage)) {
        const routeLabel = new URL(routeUrl).pathname
        throw new Error(
          `SYplat Labs verified ${routeLabel} route changed materially or now exposes public jobs`,
        )
      }
    }

    return attachInventoryEvidence([], { status: 'discovery-only', surface: REDIRECTED_HOMEPAGE_URL, firstParty: true, listingComplete: false, pagesFetched: 2 + CAREERS_ROUTE_URLS.length, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(), reason: 'verified-company-shell-and-complete-client-route-map-no-public-careers-route' })
  },
})

export const run = async (options = {}) => createSyplatLabsScraper().run(options)

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
