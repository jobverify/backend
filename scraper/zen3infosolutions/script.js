import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ZEN3_INFO_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ZEN3_INFO_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://zen3.com/careers',
  'https://zen3.com/careers/',
  'https://zen3.com/career',
  'https://zen3.com/jobs',
  'https://zen3.com/jobs/',
  'https://zen3.com/join-us',
  'https://zen3.com/work-with-us',
  'https://zen3.com/openings',
]

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|’)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions\b/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjobs at\b/i,
  /\bwork with us\b/i,
  /\blever\.co\b/i,
  /\bgreenhouse\.io\b/i,
  /\bashbyhq\.com\b/i,
  /\bworkdayjobs\.com\b/i,
  /\bmyworkdayjobs\.com\b/i,
  /\bsmartrecruiters\.com\b/i,
  /\bjobvite\.com\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const extractMainBundleAssetPath = (html = '') =>
  String(html).match(/<script[^>]+src=["']([^"']*\/static\/js\/main\.[^"']+\.js)["']/i)?.[1] ?? null

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Zen3\s*<\/title>/i.test(page)
    && /You need to enable JavaScript to run this app\./i.test(text)
    && extractMainBundleAssetPath(page) !== null
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedBundleIdentity = (bundleText = '') =>
  /react/i.test(String(bundleText))
    && !hasPublicJobsSignal(bundleText)

export const isVerifiedCareerShell = (page = {}, homepageHtml = '', bundleAssetPath = null) =>
  Number(page?.status) === 200
  && hasOfficialHomepageSignal(page?.html)
  && extractMainBundleAssetPath(page?.html ?? '') === bundleAssetPath
  && normalizeWhitespace(page?.html ?? '') === normalizeWhitespace(homepageHtml)

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

export const createZen3InfoSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Zen3 Info Solutions verified homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Zen3 Info Solutions homepage now appears to expose a public jobs surface')
    }

    const bundleAssetPath = extractMainBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('Zen3 Info Solutions homepage no longer exposes the verified client bundle')
    }

    const bundlePage = await fetchPage(new URL(bundleAssetPath, HOMEPAGE_URL).toString())
    if (bundlePage.status !== 200 || !hasVerifiedBundleIdentity(bundlePage.html)) {
      throw new Error('Zen3 Info Solutions client bundle changed materially or now exposes public job signals')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedCareerShell(routePage, homepage.html, bundleAssetPath)) {
        throw new Error(`Zen3 Info Solutions verified no-public-careers surface changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createZen3InfoSolutionsScraper().run(options)

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
