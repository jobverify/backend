import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zoomcar'
export const COMPANY = 'ZoomCar'
export const VERIFIED_ON = '2026-07-30'
export const HOMEPAGE_URL = 'https://www.zoomcar.com/'
export const CAREERS_URL = 'https://www.zoomcar.com/careers'
export const NON_WWW_CAREERS_URL = 'https://zoomcar.com/careers'
export const JOBS_URL = 'https://www.zoomcar.com/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bopen jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview all open positions\b/i,
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
  /icims/i,
  /taleo/i,
]

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

const normalizeWhitespace = (value = '') =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
  } catch {
    return false
  }
}

export const hasOfficialMarketingShellSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasCanonicalRoot =
    /<link[^>]+href="https:\/\/www\.zoomcar\.com\/"[^>]+rel="canonical"\s*\/?>/i.test(page)
    || /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.zoomcar\.com\/"\s*\/?>/i.test(page)
  const hasVerifiedSchema = /"@type"\s*:\s*"Product"/i.test(page)
    || (
      /"@type"\s*:\s*"Organization"/i.test(page)
      && /"name"\s*:\s*"Zoomcar"/i.test(page)
      && /"url"\s*:\s*"https:\/\/www\.zoomcar\.com\/?"/i.test(page)
      && /"@type"\s*:\s*"Service"/i.test(page)
    )

  return /<title id="meta-title">Zoomcar Self Drive Car Rentals in India \| Book Online<\/title>/i.test(page)
    && /<meta id="meta-desc" name="description" content="Enjoy affordable self-drive car hire with flexible plans and online booking\. Hire a car for a day or choose monthly car rentals at Zoomcar\."\s*\/?>/i.test(page)
    && /<meta property="og:type" content="(?:product|website)"/i.test(page)
    && /<meta property="og:url" content="https:\/\/www\.zoomcar\.com"/i.test(page)
    && hasCanonicalRoot
    && hasVerifiedSchema
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const assertVerifiedRoute = ({
  page,
  expectedUrl,
  routeLabel,
}) => {
  if (
    Number(page.status) !== 200
    || !matchesExpectedUrl(page.url, expectedUrl)
    || !hasOfficialMarketingShellSignal(page.html)
  ) {
    throw new Error(`The verified ${routeLabel} for Zoomcar no longer matches the consumer marketing shell`)
  }

  if (pageExposesPublicJobListings(page.html)) {
    throw new Error(`The verified ${routeLabel} for Zoomcar now appears to expose public jobs`)
  }
}

export const createZoomcarScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    assertVerifiedRoute({
      page: homepage,
      expectedUrl: HOMEPAGE_URL,
      routeLabel: 'homepage',
    })

    const careersPage = await fetchPage(CAREERS_URL)
    assertVerifiedRoute({
      page: careersPage,
      expectedUrl: CAREERS_URL,
      routeLabel: 'careers route',
    })

    const nonWwwCareersPage = await fetchPage(NON_WWW_CAREERS_URL)
    assertVerifiedRoute({
      page: nonWwwCareersPage,
      expectedUrl: CAREERS_URL,
      routeLabel: 'non-www careers alias',
    })

    const jobsPage = await fetchPage(JOBS_URL)
    assertVerifiedRoute({
      page: jobsPage,
      expectedUrl: JOBS_URL,
      routeLabel: 'jobs route',
    })

    return []
  },
})

export const run = async (options = {}) => createZoomcarScraper().run(options)

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
