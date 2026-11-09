import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AKBAR_TRAVELS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AKBAR_TRAVELS_CATALOG.source
export const COMPANY = AKBAR_TRAVELS_CATALOG.companyName
export const ROOT_URL = AKBAR_TRAVELS_CATALOG.rootUrl
export const HOME_URL = AKBAR_TRAVELS_CATALOG.homepageUrl
export const CAREERS_ROUTE_URL = AKBAR_TRAVELS_CATALOG.companyCareerPage
export const LOCALIZED_CAREERS_URL = AKBAR_TRAVELS_CATALOG.localizedCareersPage
export const VERIFIED_ON = AKBAR_TRAVELS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AKBAR_TRAVELS_CATALOG.verifiedSurfaceSummary
export const ROOT_MISSING_JOB_ROUTE_URLS = [
  'https://www.akbartravels.com/career',
  'https://www.akbartravels.com/jobs',
  'https://www.akbartravels.com/join-us',
  'https://www.akbartravels.com/openings',
  'https://www.akbartravels.com/current-openings',
]
export const LOCALIZED_MISSING_JOB_ROUTE_URLS = [
  'https://www.akbartravels.com/in/career',
  'https://www.akbartravels.com/in/jobs',
  'https://www.akbartravels.com/in/join-us',
  'https://www.akbartravels.com/in/openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob vacancy\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Akbar Travels - Best Travel Website\. Book Flights, Hotels, Holidays & more\s*<\/title>/i.test(rawHtml)
    && ['Flights', 'Hotel', 'Visa', 'Holidays', 'Bus', 'Cruise', 'Forex', 'Careers']
      .every((term) => normalized.includes(term))
    && /Akbar Travels/i.test(normalized)
}

export const hasResumeOnlyCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.akbartravels\.com\/in\/careers["']/i.test(rawHtml)
    && /<h1[^>]*>\s*Careers\s*<\/h1>/i.test(rawHtml)
    && /Many Exciting job Opportunities/i.test(normalized)
    && /Careers@akbartravels/i.test(normalized)
    && /mailto:hr@akbartravels\.com/i.test(rawHtml)
    && /Please include the job designation in the subject line/i.test(normalized)
}

export const hasPublicJobListingSignal = (html) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const getExpectedMissingRootFinalUrl = (requestedUrl) =>
  `https://www.akbartravels.com/Error/PageNotFound?aspxerrorpath=${new URL(requestedUrl).pathname}`

export const isKnownMissingJobRoute = (page = {}, requestedUrl) => {
  const finalUrl = getFinalUrl(page, requestedUrl)

  if (hasPublicJobListingSignal(page.html)) return false

  if (Number(page.status) === 200 && finalUrl === LOCALIZED_CAREERS_URL) {
    return [...ROOT_MISSING_JOB_ROUTE_URLS, ...LOCALIZED_MISSING_JOB_ROUTE_URLS].includes(requestedUrl)
      && hasResumeOnlyCareersSignal(page.html)
  }

  if (Number(page.status) === 404) {
    return finalUrl === requestedUrl
      && [...ROOT_MISSING_JOB_ROUTE_URLS, ...LOCALIZED_MISSING_JOB_ROUTE_URLS].includes(requestedUrl)
  }

  if (Number(page.status) !== 403) return false

  if (ROOT_MISSING_JOB_ROUTE_URLS.includes(requestedUrl)) {
    return finalUrl === getExpectedMissingRootFinalUrl(requestedUrl)
  }

  if (LOCALIZED_MISSING_JOB_ROUTE_URLS.includes(requestedUrl)) {
    return finalUrl === requestedUrl
      || (finalUrl === requestedUrl.replace('/in/', '/in/wordpress/')
        && /<title>\s*Error - Akbar Travels\s*<\/title>/i.test(String(page.html ?? '')))
  }

  return false
}

export const createAkbarTravelsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(ROOT_URL)
    if (getFinalUrl(homepage, ROOT_URL) !== HOME_URL) {
      throw new Error('Akbar Travels verified homepage redirect no longer matches the known public surface')
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Akbar Travels verified India homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_ROUTE_URL)
    if (getFinalUrl(careersPage, CAREERS_ROUTE_URL) !== LOCALIZED_CAREERS_URL) {
      throw new Error('Akbar Travels verified careers route no longer matches the known public surface')
    }

    if (hasPublicJobListingSignal(careersPage.html)) {
      throw new Error('Akbar Travels careers page now appears to expose a public jobs board')
    }

    if (careersPage.status !== 200 || !hasResumeOnlyCareersSignal(careersPage.html)) {
      throw new Error('Akbar Travels verified careers page no longer matches the known public surface')
    }

    for (const routeUrl of [...ROOT_MISSING_JOB_ROUTE_URLS, ...LOCALIZED_MISSING_JOB_ROUTE_URLS]) {
      const routePage = await fetchPage(routeUrl)

      if (!isKnownMissingJobRoute(routePage, routeUrl)) {
        throw new Error(`Akbar Travels verified no-public-job route changed: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAkbarTravelsScraper().run(options)

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
