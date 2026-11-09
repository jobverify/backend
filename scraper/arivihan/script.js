import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'arivihan'
export const COMPANY = 'Arivihan'
export const VERIFIED_ON = '2026-08-01'
export const HOMEPAGE_URL = 'https://www.arivihan.com/'
export const ABOUT_URL = 'https://www.arivihan.com/about'
export const CAREERS_URL = 'https://www.arivihan.com/careers'
export const NON_WWW_CAREERS_URL = 'https://arivihan.com/careers'

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

const OFFICIAL_TITLE_PATTERN =
  /<title>\s*Arivihan\s*(?:-|–|â€“)\s*India(?:'|’|â€™)?s First Fully Automated Vernacular Online Learning Platform\s*<\/title>/i

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

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return OFFICIAL_TITLE_PATTERN.test(page)
    && normalized.includes('Home')
    && normalized.includes('About')
    && normalized.includes('Contact')
    && normalized.includes('Blogs')
    && normalized.includes('Results')
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return OFFICIAL_TITLE_PATTERN.test(page)
    && normalized.includes('About Us')
    && normalized.includes('Our Mission')
    && normalized.includes('Ritesh Singh')
}

export const hasOfficialCompanySignal = (html = '') =>
  hasOfficialHomepageSignal(html) || hasOfficialAboutPageSignal(html)

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}, expectedUrl = '') => {
  const html = String(page.html ?? page.text ?? '')

  return Number(page.status) === 404
    && matchesExpectedUrl(page.url || '', expectedUrl)
    && !pageExposesPublicJobListings(html)
}

const assertVerifiedCompanyPage = ({
  page,
  expectedUrl,
  routeLabel,
  signalMatcher,
}) => {
  if (
    Number(page.status) !== 200
    || !matchesExpectedUrl(page.url, expectedUrl)
    || !signalMatcher(page.html)
  ) {
    throw new Error(`The verified ${routeLabel} for Arivihan no longer matches the official company surface`)
  }

  if (pageExposesPublicJobListings(page.html)) {
    throw new Error(`The verified ${routeLabel} for Arivihan now appears to expose public jobs`)
  }
}

export const createArivihanScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    assertVerifiedCompanyPage({
      page: homepage,
      expectedUrl: HOMEPAGE_URL,
      routeLabel: 'homepage',
      signalMatcher: hasOfficialHomepageSignal,
    })

    const aboutPage = await fetchPage(ABOUT_URL)
    assertVerifiedCompanyPage({
      page: aboutPage,
      expectedUrl: ABOUT_URL,
      routeLabel: 'about page',
      signalMatcher: hasOfficialAboutPageSignal,
    })

    const careersPage = await fetchPage(CAREERS_URL)
    if (!isVerifiedMissingCareerRoute(careersPage, CAREERS_URL)) {
      throw new Error(`Arivihan verified no-public-careers route changed: ${careersPage.url || CAREERS_URL}`)
    }

    const nonWwwCareersPage = await fetchPage(NON_WWW_CAREERS_URL)
    if (!isVerifiedMissingCareerRoute(nonWwwCareersPage, NON_WWW_CAREERS_URL)) {
      throw new Error(`Arivihan non-www careers alias changed: ${nonWwwCareersPage.url || NON_WWW_CAREERS_URL}`)
    }

    return []
  },
})

export const run = async (options = {}) => createArivihanScraper().run(options)

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
