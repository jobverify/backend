import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'capovex'
export const COMPANY = 'Capovex'
export const HOMEPAGE_URL = 'https://capovex.com/'
export const SITEMAP_URL = 'https://capovex.com/sitemap.xml'
export const BUNDLE_PATH = '/assets/index-ra0ycuT8.js'
export const BUNDLE_URL = new URL(BUNDLE_PATH, HOMEPAGE_URL).toString()
export const EXPECTED_SITEMAP_URLS = [
  'https://capovex.com/',
  'https://capovex.com/about',
]
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://capovex.com/careers',
  'https://capovex.com/career',
  'https://capovex.com/jobs',
  'https://capovex.com/join-us',
  'https://capovex.com/joinus',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_REQUIRED_SIGNALS = [
  '<title>capovex international</title>',
  'name="keywords" content="crypto staking platform, cryptocurrency staking, staking rewards, earn passive income crypto, blockchain staking"',
  'name="author" content="capovex"',
  'rel="canonical" href="https://www.capovex.com/"',
  'property="og:title" content="secure crypto staking platform"',
  'property="og:description" content="stake your crypto securely and earn passive income with high rewards and low fees."',
  'name="twitter:description" content="earn passive income by staking cryptocurrency securely."',
  '<div id="root"></div>',
  'id="zsiqscript"',
]

const BUNDLE_REQUIRED_SIGNALS = [
  'path:"/about-us"',
  'path:"/contact-us"',
  'path:"/help-center"',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bjoin our team\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /path:\s*["'`]\/careers?(?:["'`]|\/)/i,
  /path:\s*["'`]\/jobs?(?:["'`]|\/)/i,
  /path:\s*["'`]\/join-us(?:["'`]|\/)/i,
  /path:\s*["'`]\/joinus(?:["'`]|\/)/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeHtml = (value) => normalizeWhitespace(String(value ?? '')).toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const isVerifiedBundleAssetPath = (value) =>
  /^\/assets\/index-[A-Za-z0-9_-]+\.js$/i.test(String(value ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeHtml(html)
  return isVerifiedBundleAssetPath(extractBundleAssetPath(html))
    && HOMEPAGE_REQUIRED_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractSitemapUrls = (xml) =>
  (String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []).map((entry) =>
    entry.replace(/^<loc>|<\/loc>$/gi, '').trim(),
  )

export const hasVerifiedSitemapSignal = (xml) =>
  JSON.stringify(extractSitemapUrls(xml)) === JSON.stringify(EXPECTED_SITEMAP_URLS)

export const hasVerifiedBundleSignal = (bundleText) => {
  const rawText = String(bundleText ?? '')
  return BUNDLE_REQUIRED_SIGNALS.every((signal) => rawText.includes(signal))
}

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedRouteFallbackShell = (page = {}, homepageHtml, bundleAssetPath = BUNDLE_PATH) =>
  Number(page?.status) === 200
  && hasOfficialHomepageSignal(page?.html)
  && !hasPublicJobsSignal(page?.html)
  && extractBundleAssetPath(page?.html) === bundleAssetPath
  && normalizeWhitespace(page?.html) === normalizeWhitespace(homepageHtml)

export const createCapovexScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Capovex verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Capovex homepage now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasVerifiedSitemapSignal(sitemap.html)) {
      throw new Error('Capovex verified sitemap no longer matches the known no-public-careers surface')
    }

    const bundleAssetPath = extractBundleAssetPath(homepage.html)
    if (!isVerifiedBundleAssetPath(bundleAssetPath)) {
      throw new Error('Capovex homepage no longer exposes the verified client bundle')
    }

    const bundleText = await fetchText(new URL(bundleAssetPath, HOMEPAGE_URL).toString())
    if (!hasVerifiedBundleSignal(bundleText) || hasBundleJobsSignal(bundleText)) {
      throw new Error('Capovex client bundle changed materially or now exposes a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedRouteFallbackShell(routePage, homepage.html, bundleAssetPath)) {
        throw new Error(
          `Capovex checked first-party route changed materially or now exposes public jobs: ${routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCapovexScraper().run(options)

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
