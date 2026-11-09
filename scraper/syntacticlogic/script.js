import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'syntacticlogic'
export const COMPANY = 'Syntacticlogic Technology'
export const HOMEPAGE_URL = 'https://syntacticlogic.com/'
export const CAREERS_URL = 'https://syntacticlogic.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
}

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /\bjob posting\b/i,
  /\bjob openings\b/i,
  /\bopen positions\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /recruitcrm/i,
  /freshteam/i,
  /darwinbox/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'syntacticlogic.com' || hostname === 'www.syntacticlogic.com'
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const isRedesignedHomepage = /<title[^>]*>\s*home\s*-\s*syntacticlogic technology services\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/syntacticlogic\.com\/?["']/i.test(page)

  return isRedesignedHomepage || (
    normalized.includes('syntacticlogic technology services')
      && /href=["'][^"']*\/careers\/["']/i.test(page)
      && /href=["'][^"']*\/contact-us\/["']/i.test(page)
  )
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyJobListingLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl.href)) {
      continue
    }

    const pathname = absoluteUrl.pathname.replace(/\/+$/, '') || '/'
    if (pathname === '/careers' || pathname === '/jobs' || pathname === '/job' || pathname === '/openings') {
      continue
    }

    if (/^\/(?:careers|jobs?|openings)\/.+/i.test(pathname)) {
      return true
    }
  }

  return false
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('careers - syntacticlogic technology services')
    && normalized.includes('current openings')
    && normalized.includes('please share us your profile to careers@syntacticlogic.com')
    && normalized.includes('careers@syntacticlogic.com')
    && !hasPublicJobsSignal(page)
    && !hasFirstPartyJobListingLink(page)
}

export const createSyntacticlogicScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Syntacticlogic verified official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Syntacticlogic careers page changed materially or now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createSyntacticlogicScraper().run(options)

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
