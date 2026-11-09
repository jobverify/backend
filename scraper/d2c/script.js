import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'd2c'
export const COMPANY = 'D2C'
export const VERIFIED_AT = '2026-07-14'
export const HOMEPAGE_URL = 'https://d2c.in/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://d2c.in/careers',
  'https://d2c.in/careers/',
  'https://d2c.in/career',
  'https://d2c.in/jobs',
  'https://d2c.in/jobs/',
  'https://d2c.in/join-us',
  'https://d2c.in/work-with-us',
  'https://d2c.in/openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|’)re hiring\b/i,
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
  /\bbreezy\.hr\b/i,
]

const CAREER_ROUTE_LINK_PATTERN =
  /href=["'][^"']*\/(?:careers?|jobs?|join-us|work-with-us|openings)(?:[\/"'?#]|$)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Mirav Labs\s*[—-]\s*Production AI for Modern Enterprise\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Mirav Labs deploys production-grade AI/i.test(page)
    && text.includes('mirav labs')
    && text.includes('mirav aegis')
    && text.includes('network ai')
    && text.includes('voice ai')
    && text.includes('deepak@d2c.in')
    && text.includes('book a demo call')
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasCareerRouteLinkSignal = (html = '') =>
  CAREER_ROUTE_LINK_PATTERN.test(String(html ?? ''))

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')

  return Number(page?.status) === 404
    && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
    && /The requested URL was not found on this server\./i.test(html)
    && /Apache\/[\d.]+\s+\(Ubuntu\)\s+Server at d2c\.in Port 443/i.test(html)
    && !hasPublicJobsSignal(html)
}

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

export const createD2CScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('D2C verified official homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html) || hasCareerRouteLinkSignal(homepage.html)) {
      throw new Error('D2C homepage now appears to expose a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`D2C verified no-public-careers surface changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createD2CScraper().run(options)

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
