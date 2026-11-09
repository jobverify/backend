import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nslhubbrane'
export const COMPANY = 'NSLHUB (Brane)'
export const HOMEPAGE_URL = 'https://braneenterprises.com/'
export const LEGACY_NSLHUB_LANDER_URL = 'https://nslhub.in/lander'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://braneenterprises.com/careers',
  'https://braneenterprises.com/careers/',
  'https://braneenterprises.com/career',
  'https://braneenterprises.com/career/',
  'https://braneenterprises.com/jobs',
  'https://braneenterprises.com/jobs/',
  'https://braneenterprises.com/join-us',
  'https://braneenterprises.com/join-us/',
  'https://braneenterprises.com/openings',
  'https://braneenterprises.com/openings/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_REQUIRED_SIGNALS = [
  '<title>brane</title>',
  '<base href="/">',
  '<app-root></app-root>',
  'scrolllottie.js',
  'bodymovin/5.7.4/lottie.min.js',
  'swiper.min.js',
  'gtm-wtbxddgv',
  'gtag/js?id=g-j71td8bckt',
]

const LEGACY_LANDER_REQUIRED_SIGNALS = [
  'window.lander_system="pw"',
  'window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})',
  'parking-lander/static/js/main.',
  'parking-lander/static/css/main.',
  '<div id="root"></div>',
]

const BUNDLE_IDENTITY_PATTERNS = [
  /self\.webpackChunkbrane_ui/,
  /NSL Hub\s*\(Natural Solutions Language\)/i,
  /vss\.carnivalsb\.nslhub\.com/i,
  /nslhub-beta-s3\.s3\.ap-south-1\.amazonaws\.com\/new_ui_videos\//i,
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bapply now\b/i,
  /\bview jobs?\b/i,
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
  /path:\s*["'`]\/careers?(?:\/|["'`])/i,
  /path:\s*["'`]\/jobs?(?:\/|["'`])/i,
  /path:\s*["'`]\/join-us(?:\/|["'`])/i,
  /path:\s*["'`]\/openings(?:\/|["'`])/i,
  /\bcareers? at\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
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

export const extractMainBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*main\.[^"']+\.js)["'][^>]*><\/script>/i,
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeHtml(html)
  return extractMainBundleAssetPath(html) !== null
    && HOMEPAGE_REQUIRED_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedBundleIdentity = (bundleText) =>
  BUNDLE_IDENTITY_PATTERNS.every((pattern) => pattern.test(String(bundleText ?? '')))

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const hasLegacyNslhubLanderSignal = (html) => {
  const normalized = normalizeHtml(html)
  return LEGACY_LANDER_REQUIRED_SIGNALS.every((signal) => normalized.includes(signal))
    && !hasPublicJobsSignal(html)
}

const isSameOrigin = (value, baseUrl) => {
  try {
    return new URL(value).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}

export const isVerifiedRouteFallbackShell = (page = {}, homepageHtml, bundleAssetPath) =>
  Number(page?.status) === 200
  && hasOfficialHomepageSignal(page?.html)
  && !hasPublicJobsSignal(page?.html)
  && extractMainBundleAssetPath(page?.html) === bundleAssetPath
  && normalizeWhitespace(page?.html) === normalizeWhitespace(homepageHtml)

export const createNslhubBraneScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Brane verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Brane homepage now appears to expose a public jobs surface')
    }

    const bundleAssetPath = extractMainBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('Brane homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundleText = await fetchText(bundleUrl)

    if (!hasVerifiedBundleIdentity(bundleText) || hasBundleJobsSignal(bundleText)) {
      throw new Error('Brane client bundle changed materially or now exposes a public jobs surface')
    }

    const legacyLander = await fetchPage(LEGACY_NSLHUB_LANDER_URL)
    if (legacyLander.status !== 200 || !hasLegacyNslhubLanderSignal(legacyLander.html)) {
      throw new Error('NSL Hub legacy lander no longer matches the verified first-party parked surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      const finalUrl = routePage.url || routeUrl

      if (
        !isSameOrigin(finalUrl, HOMEPAGE_URL)
        || !isVerifiedRouteFallbackShell(routePage, homepage.html, bundleAssetPath)
      ) {
        throw new Error(
          `Brane checked first-party route changed materially or now exposes public jobs: ${finalUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNslhubBraneScraper().run(options)

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
