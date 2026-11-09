import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FRESHMENU_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FRESHMENU_CATALOG.source
export const COMPANY = FRESHMENU_CATALOG.companyName
export const HOMEPAGE_URL = FRESHMENU_CATALOG.homepageUrl
export const ABOUT_URL = FRESHMENU_CATALOG.aboutPageUrl
export const MISSING_JOB_ROUTE_URLS = FRESHMENU_CATALOG.checkedMissingRouteUrls
export const VERIFIED_ON = FRESHMENU_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = FRESHMENU_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = FRESHMENU_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE = 'Order food online. Get fresh food delivery from FreshMenu.'
const GENERIC_APP_SHELL_TITLE = 'Fresh food online. Order Tasty food from FreshMenu.'
const CURRENT_APP_SHELL_TITLE = 'FreshMenu \u2014 Made fresh. Served fresh.'
const CURRENT_APP_SHELL_DESCRIPTION =
  'Chef-made world cuisine, ranked by what people actually order. Browse the FreshMenu board and plan bulk orders for your team or party.'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen roles\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /successfactors/i,
  /darwinbox/i,
  /jobvite/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&#x27;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

export const hasPublicJobListingSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const hasSharedApexShellSignal = (rawHtml, normalized) =>
  /href=["']\/about["']/i.test(rawHtml)
  && /href=["']\/blogs["']/i.test(rawHtml)
  && /href=["']\/corporate["']/i.test(rawHtml)
  && /add to cart/i.test(normalized)
  && /corporate discount/i.test(normalized)
  && !hasPublicJobListingSignal(rawHtml)

const hasCurrentAppShellSignal = (rawHtml) =>
  new RegExp(`<title>\\s*${escapeRegExp(CURRENT_APP_SHELL_TITLE)}\\s*<\\/title>`, 'i').test(rawHtml)
  && rawHtml.includes(CURRENT_APP_SHELL_DESCRIPTION)
  && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']FreshMenu["']/i.test(rawHtml)
  && /<script[^>]+src=["']\/assets\/index-[^"']+\.js["']/i.test(rawHtml)
  && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(rawHtml)
  && !hasPublicJobListingSignal(rawHtml)

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return (
    new RegExp(`<title>\\s*${escapeRegExp(HOMEPAGE_TITLE)}\\s*<\\/title>`, 'i').test(rawHtml)
    && hasSharedApexShellSignal(rawHtml, normalized)
    && /freshmenu cares/i.test(normalized)
    && /freshpass/i.test(normalized)
    && /open the link in mobile browser for better experience/i.test(normalized)
  ) || hasCurrentAppShellSignal(rawHtml)
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return (
    new RegExp(`<title>\\s*${escapeRegExp(GENERIC_APP_SHELL_TITLE)}\\s*<\\/title>`, 'i').test(rawHtml)
    && hasSharedApexShellSignal(rawHtml, normalized)
  ) || hasCurrentAppShellSignal(rawHtml)
}

export const isKnownMissingJobRoute = (page = {}, requestedUrl) =>
  Number(page?.status) === 200
  && (page?.url || requestedUrl) === requestedUrl
  && hasOfficialAboutPageSignal(page?.html)
  && !hasPublicJobListingSignal(page?.html)

export const createFreshMenuScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('FreshMenu verified homepage no longer matches the known no-public-jobs surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || aboutPage.url !== ABOUT_URL) {
      throw new Error('FreshMenu verified about page no longer matches the known no-public-jobs surface')
    }

    if (!hasOfficialAboutPageSignal(aboutPage.html)) {
      throw new Error('FreshMenu about page changed materially or now exposes a public jobs surface')
    }

    for (const routeUrl of MISSING_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isKnownMissingJobRoute(routePage, routeUrl)) {
        throw new Error(`FreshMenu verified no-public-job route changed: ${routePage?.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createFreshMenuScraper().run(options)

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
