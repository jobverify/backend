import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'blusmart'
export const COMPANY = 'BluSmart'
export const VERIFIED_ON = '2026-07-30'
export const HOMEPAGE_URL = 'https://blusmart.com/'
export const LEGACY_CAREERS_URL = 'https://www.blusmart.in/careers'
export const MISSING_CAREERS_URL = 'https://blusmart.com/careers'

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

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
  } catch {
    return false
  }
}

export const hasOfficialPlaceholderSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*BluSmart tablets\s*<\/title>/i.test(page)
    && /<meta\s+property="og:title"\s+content="BluSmart Tablets">/i.test(page)
    && normalized.includes('bluSmart')
    && normalized.includes('info@blusmart.com')
    && normalized.includes('Facebook')
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}, expectedUrl = '') => {
  const html = String(page.html ?? page.text ?? '')

  return Number(page.status) === 404
    && matchesExpectedUrl(page.url || '', expectedUrl)
    && !pageExposesPublicJobListings(html)
}

export const createBluSmartScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage.status) !== 200
      || !matchesExpectedUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialPlaceholderSignal(homepage.html)
    ) {
      throw new Error('The verified exact-name homepage for BluSmart no longer matches the placeholder surface')
    }

    if (pageExposesPublicJobListings(homepage.html)) {
      throw new Error('The exact-name BluSmart homepage now appears to expose a public jobs surface')
    }

    const legacyCareers = await fetchPage(LEGACY_CAREERS_URL)
    if (
      Number(legacyCareers.status) !== 200
      || !matchesExpectedUrl(legacyCareers.url, HOMEPAGE_URL)
      || !hasOfficialPlaceholderSignal(legacyCareers.html)
    ) {
      throw new Error('The verified BluSmart legacy careers alias no longer matches the exact-name placeholder surface')
    }

    if (pageExposesPublicJobListings(legacyCareers.html)) {
      throw new Error('The BluSmart legacy careers alias now appears to expose public jobs')
    }

    const missingCareersRoute = await fetchPage(MISSING_CAREERS_URL)
    if (!isVerifiedMissingCareerRoute(missingCareersRoute, MISSING_CAREERS_URL)) {
      throw new Error(`BluSmart verified no-public-careers route changed: ${missingCareersRoute.url || MISSING_CAREERS_URL}`)
    }

    return []
  },
})

export const run = async (options = {}) => createBluSmartScraper().run(options)

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
