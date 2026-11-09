import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mentamind'
export const COMPANY = 'Mentamind'
export const HOMEPAGE_URL = 'https://mentamind.in/'
export const LEGAL_ROUTE_URLS = [
  'https://mentamind.in/privacy-policy',
  'https://mentamind.in/terms-of-service',
]
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://mentamind.in/careers',
  'https://mentamind.in/career',
  'https://mentamind.in/jobs',
  'https://mentamind.in/job-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BUNDLE_REQUIRED_SIGNALS = [
  'Mentamind Technologies Private Limited',
  'support@mentamind.in',
  '/privacy-policy',
  '/terms-of-service',
]

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

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /\/careers\b/i,
  /\/career\b/i,
  /\/jobs\b/i,
  /\/job-openings\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /bamboohr\.com/i,
  /freshteam/i,
  /darwinbox/i,
  /keka\.com/i,
  /smartrecruiters/i,
  /jobscore/i,
  /join\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/>\s+</g, '><'),
)

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'mentamind.in' || hostname === 'www.mentamind.in'
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

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
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
    /<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["'][^>]*><\/script>/i,
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Mentamind\s*-\s*AI Mental Health Support\s*<\/title>/i.test(page)
    && /<div id=["']root["']><\/div>/i.test(page)
    && extractMainBundleAssetPath(page) !== null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedBundleIdentity = (bundleText) =>
  BUNDLE_REQUIRED_SIGNALS.every((signal) => String(bundleText ?? '').includes(signal))

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const computeSha256 = (value) =>
  createHash('sha256').update(normalizeComparableHtml(value)).digest('hex')

export const isVerifiedLegalRoutePage = (page = {}, bundleAssetPath) =>
  Number(page.status) === 200
  && isFirstPartyUrl(page.url || HOMEPAGE_URL)
  && hasOfficialHomepageSignal(page.html)
  && extractMainBundleAssetPath(page.html) === bundleAssetPath
  && !hasPublicJobsSignal(page.html)

export const isVerifiedRouteFallbackShell = (page = {}, homepageHtml, bundleAssetPath) =>
  Number(page.status) === 200
  && isFirstPartyUrl(page.url || HOMEPAGE_URL)
  && hasOfficialHomepageSignal(page.html)
  && extractMainBundleAssetPath(page.html) === bundleAssetPath
  && !hasPublicJobsSignal(page.html)
  && computeSha256(page.html) === computeSha256(homepageHtml)

export const createMentamindScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Mentamind verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Mentamind homepage now appears to expose a public jobs surface')
    }

    const bundleAssetPath = extractMainBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('Mentamind homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundleText = await fetchText(bundleUrl)

    if (!hasVerifiedBundleIdentity(bundleText) || hasBundleJobsSignal(bundleText)) {
      throw new Error('Mentamind client bundle changed materially or now exposes a public jobs surface')
    }

    for (const routeUrl of LEGAL_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedLegalRoutePage(routePage, bundleAssetPath)) {
        throw new Error('Mentamind legal routes changed materially or are no longer first-party')
      }
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedRouteFallbackShell(routePage, homepage.html, bundleAssetPath)) {
        throw new Error('Mentamind checked first-party routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMentamindScraper().run(options)

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
