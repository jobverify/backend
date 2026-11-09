import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'solarbullenergy'
export const COMPANY = 'Solar Bull Energy'
export const HOMEPAGE_URL = 'https://www.solarbull.in/'
export const ASSET_MANIFEST_URL = 'https://www.solarbull.in/asset-manifest.json'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.solarbull.in/careers',
  'https://www.solarbull.in/career',
  'https://www.solarbull.in/jobs',
  'https://www.solarbull.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
]

const BUNDLE_REQUIRED_SIGNALS = [
  'Solar Bull Energy LLP',
  'SolarBull Energy LLP',
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'www.solarbull.in' || hostname === 'solarbull.in'
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

export const extractMainBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/static\/js\/main\.[^"']+\.js)["'][^>]*><\/script>/i,
  )

  return match?.[1] ?? null
}

export const extractMainBundlePathFromAssetManifest = (manifestText) => {
  try {
    const manifest = JSON.parse(String(manifestText ?? '{}'))
    return manifest?.files?.['main.js'] || null
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return extractMainBundleAssetPath(page) !== null
    && normalized.includes('you need to enable javascript to run this app.')
    && /<div id=["']root["']><\/div>/i.test(page)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedBundleIdentity = (bundleText) =>
  BUNDLE_REQUIRED_SIGNALS.every((signal) => String(bundleText ?? '').includes(signal))

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedRouteFallbackShell = (page = {}, homepageHtml, bundleAssetPath) =>
  Number(page?.status) === 200
  && isFirstPartyUrl(page?.url || HOMEPAGE_URL)
  && hasOfficialHomepageSignal(page?.html)
  && !hasPublicJobsSignal(page?.html)
  && extractMainBundleAssetPath(page?.html) === bundleAssetPath
  && normalizeWhitespace(page?.html) === normalizeWhitespace(homepageHtml)

export const createSolarBullEnergyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Solar Bull Energy verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Solar Bull Energy homepage now appears to expose a public jobs surface')
    }

    const bundleAssetPath = extractMainBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('Solar Bull Energy homepage no longer exposes the verified client bundle')
    }

    const assetManifest = await fetchPage(ASSET_MANIFEST_URL)
    const manifestBundlePath = extractMainBundlePathFromAssetManifest(assetManifest.html)
    if (assetManifest.status !== 200 || manifestBundlePath !== bundleAssetPath) {
      throw new Error('Solar Bull Energy asset manifest no longer matches the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundlePage = await fetchPage(bundleUrl)
    if (
      bundlePage.status !== 200
      || !hasVerifiedBundleIdentity(bundlePage.html)
      || hasBundleJobsSignal(bundlePage.html)
    ) {
      throw new Error('Solar Bull Energy client bundle changed materially or now exposes a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedRouteFallbackShell(routePage, homepage.html, bundleAssetPath)) {
        throw new Error('Solar Bull Energy checked first-party routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSolarBullEnergyScraper().run(options)

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
