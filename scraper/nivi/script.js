import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { NIVI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = NIVI_CATALOG.source
export const COMPANY = NIVI_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = NIVI_CATALOG.officialBrandName
export const VERIFIED_ON = NIVI_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = NIVI_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = NIVI_CATALOG.homepageUrl
export const ABOUT_URL = NIVI_CATALOG.officialAboutUrl
export const CAREERS_URL = NIVI_CATALOG.companyCareerPage
export const CLIENT_BUNDLE_URL = NIVI_CATALOG.clientBundleUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /\bapply now\b/i,
  /\bjobposting\b/i,
  /\brequisition\b/i,
  /\bjob id\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards(?:\.eu)?\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageShellSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Nivi:\s*outcomes driven by insight\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Nivi is a messaging-first health platform delivering consumer insights, engagement innovation, and health outcomes at scale across emerging markets\./i.test(page)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Nivi Inc\.["']/i.test(page)
    && /<div id=["']root["']><\/div>/i.test(page)
    && extractBundleAssetPath(page) !== null
}

export const hasVerifiedAboutCtaSignal = (bundleText) => {
  const bundle = normalizeWhitespace(bundleText)

  return /Join Our Team/i.test(bundle)
    && /View Open Positions/i.test(bundle)
    && /to:"\/careers"/i.test(bundle)
}

export const hasVerifiedNoOpenPositionsSignal = (bundleText) => {
  const bundle = normalizeWhitespace(bundleText)

  return /Careers at Nivi/i.test(bundle)
    && /No Open Positions/i.test(bundle)
    && /We don't have any open positions at the moment/i.test(bundle)
    && /Get in Touch/i.test(bundle)
}

export const bundleExposesPublicJobListings = (bundleText) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

const routeMatchesVerifiedShell = (html, bundleAssetPath) =>
  hasOfficialHomepageShellSignal(html) && extractBundleAssetPath(html) === bundleAssetPath

export const createNiviScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageShellSignal(homepage.html)) {
      throw new Error('NIVI verified homepage shell no longer matches the official first-party surface')
    }

    const bundleAssetPath = extractBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('NIVI homepage shell no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    if (!/^https:\/\/nivi\.io\/assets\/index-[^/]+\.js$/i.test(bundleUrl)) {
      throw new Error('NIVI homepage shell no longer exposes the verified client bundle URL')
    }

    for (const routeUrl of [ABOUT_URL, CAREERS_URL]) {
      const route = await fetchPage(routeUrl)
      if (route.status !== 200 || !routeMatchesVerifiedShell(route.html, bundleAssetPath)) {
        throw new Error('NIVI verified first-party routes no longer match the known homepage shell')
      }
    }

    const bundleText = await fetchText(bundleUrl)

    if (!hasVerifiedAboutCtaSignal(bundleText) || !hasVerifiedNoOpenPositionsSignal(bundleText)) {
      throw new Error('NIVI client bundle no longer matches the verified no-open-positions careers contract')
    }

    if (bundleExposesPublicJobListings(bundleText)) {
      throw new Error('NIVI client bundle now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createNiviScraper().run(options)

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
