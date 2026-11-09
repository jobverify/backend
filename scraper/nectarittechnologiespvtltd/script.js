import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nectarittechnologiespvtltd'
export const COMPANY = 'NectarIt Technologies Pvt Ltd.'
export const HOMEPAGE_URL = 'https://www.nectarit.com/'
export const CAREERS_URL = 'https://www.nectarit.com/about'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'connect & analyze. optimize operations | nectarit technologies',
  'a social world of connected assets',
  'nectarit technologies private limited',
  'info@nectarit.com',
]

const CAREERS_PAGE_SIGNALS = [
  'extracting sweetness of things | nectarit technologies',
  'who we are?',
  'team nectar.',
  'career@nectarit.com',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
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

const SUSPICIOUS_HOST_PATTERN =
  /(greenhouse|job-boards\.greenhouse|lever|workday|myworkdayjobs|smartrecruiters|ashby|workable|darwinbox|icims|successfactors|taleo|jobvite|recruitcrm|teamtailor|oraclecloud|dayforce|jobs\.)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
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
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return CAREERS_PAGE_SIGNALS.every((signal) => normalized.includes(signal))
    && /join us\??\s*let us know/i.test(normalized)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || seen.has(absoluteUrl)) continue

    const url = new URL(absoluteUrl)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const isSamePage = absoluteUrl === CAREERS_URL || `${absoluteUrl}/` === CAREERS_URL
    const exposesFirstPartyJobPath =
      (url.hostname === 'www.nectarit.com' || url.hostname === 'nectarit.com')
      && /\/(jobs?|job-openings?|openings?|vacanc(?:y|ies)|careers?)(\/|$)/i.test(pathname)
      && !isSamePage

    if (SUSPICIOUS_HOST_PATTERN.test(url.hostname) || exposesFirstPartyJobPath) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

export const createNectarItTechnologiesPvtLtdScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('NectarIT Technologies verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('NectarIT Technologies homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('NectarIT Technologies verified official about-page recruiting surface no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('NectarIT Technologies about page now appears to expose a public jobs surface')
    }

    const suspiciousLinks = extractSuspiciousPublicJobLinks(careersPage.html)
    if (suspiciousLinks.length > 0) {
      throw new Error('NectarIT Technologies about page now exposes public job links')
    }

    return []
  },
})

export const run = async (options = {}) => createNectarItTechnologiesPvtLtdScraper().run(options)

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
