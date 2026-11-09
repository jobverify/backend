import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'allohealth'
export const COMPANY = 'Allo Health'
export const VERIFIED_ON = '2026-10-03'
export const HOMEPAGE_URL = 'https://www.allohealth.com/'
export const ABOUT_URL = 'https://www.allohealth.com/about'
export const CAREERS_URL = 'https://www.allohealth.com/careers'
export const NON_WWW_CAREERS_URL = 'https://allohealth.com/careers'
export const TEAM_FORM_URL = 'https://airtable.com/app3JO79fwEz4srgJ/shrD53PpCm2BKq5O9'

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
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
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

const HTML_APOSTROPHE = "(?:'|&#39;|&#x27;|&apos;)"

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const currentTitle = /<title>\s*Allo Health - Sexual Health, Therapy &amp; STI Care in India\s*<\/title>/i.test(page)

  return (
    /<title>\s*Best STI Doctors in India \|\s*Allo Health\s*<\/title>/i.test(page)
    || new RegExp(`<title>\\s*Allo Health India${HTML_APOSTROPHE}?s Sexual Health Provider\\s*<\\/title>`, 'i').test(page)
    || new RegExp(`<title>\\s*Allo Health\\s*-\\s*India${HTML_APOSTROPHE}?s\\s*#1 Sexual Health Provider\\s*<\\/title>`, 'i').test(page)
    || currentTitle
  )
    && /<meta name="description" content="/i.test(page)
    && /<link rel="canonical" href="https:\/\/www\.allohealth\.com"\/?>/i.test(page)
    && /<meta property="og:url" content="https:\/\/www\.allohealth\.com"/i.test(page)
    && /<meta property="og:type" content="website"/i.test(page)
    && /About us/i.test(normalized)
    && normalized.includes('Allo Health')
    && (!currentTitle || (
      page.includes(TEAM_FORM_URL)
      && page.includes('Join Our Team')
      && page.includes('PATIENT FIRST HEALTHTECH PRIVATE LIMITED')
    ))
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return (
    /<title>\s*Best STI Doctors in India \|\s*Allo Health\s*<\/title>/i.test(page)
    || new RegExp(`<title>\\s*About Allo Health \\|\\s*India${HTML_APOSTROPHE}?s Leading Sexual Health Provider\\s*<\\/title>`, 'i').test(page)
    || /<title>\s*About Allo Health \|\s*Leading Sexual Health Care\s*<\/title>/i.test(page)
  )
    && /<link rel="canonical" href="https:\/\/www\.allohealth\.com\/about"\/?>/i.test(page)
    && /<meta property="og:url" content="https:\/\/www\.allohealth\.com\/about"/i.test(page)
    && /<meta property="og:type" content="website"/i.test(page)
    && /About us/i.test(normalized)
    && normalized.includes('70+ cities')
    && normalized.includes('structured healthcare ecosystem')
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}, expectedUrl = '') => {
  const html = String(page.html ?? page.text ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page.status) === 404
    && matchesExpectedUrl(page.url || '', expectedUrl)
    && /<title>\s*Allo Health\s*<\/title>/i.test(html)
    && normalized.includes('Not Found')
    && /About us/i.test(normalized)
    && !pageExposesPublicJobListings(html)
}

const assertVerifiedPage = ({
  page,
  expectedUrl,
  routeLabel,
  signal,
}) => {
  if (
    Number(page.status) !== 200
    || !matchesExpectedUrl(page.url, expectedUrl)
    || !signal(page.html)
  ) {
    throw new Error(`The verified ${routeLabel} for Allo Health no longer matches the official company surface`)
  }

  if (pageExposesPublicJobListings(page.html)) {
    throw new Error(`The verified ${routeLabel} for Allo Health now appears to expose public jobs`)
  }
}

export const createAllohealthScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    assertVerifiedPage({
      page: homepage,
      expectedUrl: HOMEPAGE_URL,
      routeLabel: 'homepage',
      signal: hasOfficialHomepageSignal,
    })

    const aboutPage = await fetchPage(ABOUT_URL)
    assertVerifiedPage({
      page: aboutPage,
      expectedUrl: ABOUT_URL,
      routeLabel: 'about page',
      signal: hasOfficialAboutPageSignal,
    })

    const careersPage = await fetchPage(CAREERS_URL)
    if (!isVerifiedMissingCareerRoute(careersPage, CAREERS_URL)) {
      throw new Error(`Allo Health verified no-public-careers route changed: ${careersPage.url || CAREERS_URL}`)
    }

    const nonWwwCareersPage = await fetchPage(NON_WWW_CAREERS_URL)
    if (!isVerifiedMissingCareerRoute(nonWwwCareersPage, CAREERS_URL)) {
      throw new Error(`Allo Health non-www careers alias changed: ${nonWwwCareersPage.url || NON_WWW_CAREERS_URL}`)
    }

    return []
  },
})

export const run = async (options = {}) => createAllohealthScraper().run(options)

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
