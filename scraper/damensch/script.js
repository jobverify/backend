import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'damensch'
export const COMPANY = 'DaMENSCH'
export const VERIFIED_ON = '2026-07-30'
export const HOMEPAGE_URL = 'https://www.damensch.com/'
export const ABOUT_URL = 'https://www.damensch.com/about-us'
export const CAREERS_URL = 'https://www.damensch.com/careers'
export const JOBS_URL = 'https://www.damensch.com/jobs'
export const PAGES_CAREERS_URL = 'https://www.damensch.com/pages/careers'

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

const decodeEntities = (value = '') =>
  String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value = '') =>
  decodeEntities(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

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
  const title = extractTitle(html)
  const text = normalizeText(html)

  return /^Men's Clothing \| Buy Mens Apparel Online in India \| Damensch$/i.test(title || '')
    && text.includes('DOWNLOAD THE APP!')
    && text.includes('EVERYTHING IS BETTER ON THE APP')
    && text.includes('Innerwear')
    && text.includes('Topwear')
    && text.includes('Bottomwear')
    && text.includes('30 Day Free Trial')
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const title = extractTitle(html)
  const text = normalizeText(html)

  return /^About us - Premium & Sustainable Menswear brand - DaMENSCH$/i.test(title || '')
    && text.includes('About Damensch')
    && text.includes('Fashion That Thinks')
    && text.includes('We believe thoughtfulness can bridge any gap')
    && text.includes('the men\'s fashion industry for innovation')
    && text.includes('Think Sustainability')
}

export const hasStorefrontShellSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('DOWNLOAD THE APP!')
    && text.includes('EVERYTHING IS BETTER ON THE APP')
    && text.includes('Innerwear')
    && text.includes('Topwear')
    && text.includes('Bottomwear')
    && text.includes('Company')
    && text.includes('Experience the DaMENSCH Mobile App')
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}, expectedUrl = '') => {
  const html = String(page.html ?? page.text ?? '')
  const text = normalizeText(html)

  return Number(page.status) === 404
    && matchesExpectedUrl(page.url || '', expectedUrl)
    && /^DaMENSCH$/i.test(extractTitle(html) || '')
    && text.includes('404 Page not found')
    && text.includes("doesn't exist or the link is incorrect")
    && !pageExposesPublicJobListings(html)
}

export const isVerifiedStorefrontShellPage = (page = {}, expectedUrl = '') =>
  Number(page.status) === 200
  && matchesExpectedUrl(page.url || '', expectedUrl)
  && hasStorefrontShellSignal(page.html)
  && !pageExposesPublicJobListings(page.html)

const assertVerifiedCompanyPage = ({
  page,
  expectedUrl,
  routeLabel,
  matcher,
}) => {
  if (
    Number(page.status) !== 200
    || !matchesExpectedUrl(page.url || '', expectedUrl)
    || !matcher(page.html)
  ) {
    throw new Error(`The verified ${routeLabel} for DaMENSCH no longer matches the official company surface`)
  }

  if (pageExposesPublicJobListings(page.html)) {
    throw new Error(`The verified ${routeLabel} for DaMENSCH now appears to expose public jobs`)
  }
}

const assertVerifiedRoute = ({
  page,
  expectedUrl,
  routeLabel,
  matcher,
}) => {
  if (!matcher(page, expectedUrl)) {
    throw new Error(`The verified ${routeLabel} for DaMENSCH no longer matches the expected no-public-careers surface`)
  }
}

export const createDamenschScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    assertVerifiedCompanyPage({
      page: homepage,
      expectedUrl: HOMEPAGE_URL,
      routeLabel: 'homepage',
      matcher: hasOfficialHomepageSignal,
    })

    const aboutPage = await fetchPage(ABOUT_URL)
    assertVerifiedCompanyPage({
      page: aboutPage,
      expectedUrl: ABOUT_URL,
      routeLabel: 'about page',
      matcher: hasOfficialAboutPageSignal,
    })

    const careersPage = await fetchPage(CAREERS_URL)
    assertVerifiedRoute({
      page: careersPage,
      expectedUrl: CAREERS_URL,
      routeLabel: 'careers route',
      matcher: isVerifiedMissingCareerRoute,
    })

    const jobsPage = await fetchPage(JOBS_URL)
    assertVerifiedRoute({
      page: jobsPage,
      expectedUrl: JOBS_URL,
      routeLabel: 'jobs route',
      matcher: isVerifiedMissingCareerRoute,
    })

    const pagesCareersPage = await fetchPage(PAGES_CAREERS_URL)
    assertVerifiedRoute({
      page: pagesCareersPage,
      expectedUrl: PAGES_CAREERS_URL,
      routeLabel: 'pages/careers route',
      matcher: isVerifiedStorefrontShellPage,
    })

    return []
  },
})

export const run = async (options = {}) => createDamenschScraper().run(options)

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
