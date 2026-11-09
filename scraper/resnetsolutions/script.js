import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'resnetsolutions'
export const COMPANY = 'ResNet Solutions Private Limited'
export const HOMEPAGE_URL = 'https://www.resnetsolution.com/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.resnetsolution.com/careers',
  'https://www.resnetsolution.com/career',
  'https://www.resnetsolution.com/jobs',
  'https://www.resnetsolution.com/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_LINKEDIN_URL = 'https://www.linkedin.com/company/resnet-solutions-private-limited/'

const HOMEPAGE_SIGNALS = [
  'resnet - your premier partner',
  '© - 2024 resnet pvt ltd | all right reserved',
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

const BUNDLE_REQUIRED_SIGNALS = [
  'Resnet Solutions',
  'Home',
  'Services',
  'About Us',
  'Success Stories',
  'Blog',
  'Contact Us',
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /["'`]\/careers?(?:\/|["'`])/i,
  /["'`]\/jobs?(?:\/|["'`])/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'www.resnetsolution.com' || hostname === 'resnetsolution.com'
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
    headers: {
      server: response.headers.get('server'),
      xMatchedPath: response.headers.get('x-matched-path'),
    },
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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
    && page.includes(OFFICIAL_LINKEDIN_URL)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/_next\/static\/chunks\/app\/page-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const hasVerifiedBundleSignal = (bundleText) =>
  BUNDLE_REQUIRED_SIGNALS.every((signal) => String(bundleText ?? '').includes(signal))

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) =>
  isFirstPartyUrl(page.url || HOMEPAGE_URL)
  && Number(page.status) === 404
  && !hasPublicJobsSignal(page.html)
  && (
    String(page.headers?.xMatchedPath || '') === '/404'
    || /404/i.test(String(page.html ?? ''))
  )

export const createResNetSolutionsScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('ResNet Solutions verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('ResNet Solutions homepage now appears to expose a public jobs surface')
    }

    const bundleAssetPath = extractBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('ResNet Solutions homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundleText = await fetchText(bundleUrl)

    if (!hasVerifiedBundleSignal(bundleText) || hasBundleJobsSignal(bundleText)) {
      throw new Error('ResNet Solutions client bundle changed materially or now exposes a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error('ResNet Solutions careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createResNetSolutionsScraper().run(options)

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
