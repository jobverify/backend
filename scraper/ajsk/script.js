import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ajsk'
export const COMPANY = 'AJSK'
export const VERIFIED_AT = '2026-07-15'
export const HOMEPAGE_URL = 'https://www.ajsk.com/'
export const PAGES_API_URL = 'https://www.ajsk.com/wp-json/wp/v2/pages?per_page=100'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.ajsk.com/careers/',
  'https://www.ajsk.com/career/',
  'https://www.ajsk.com/jobs/',
  'https://www.ajsk.com/join-us/',
  'https://www.ajsk.com/work-with-us/',
  'https://www.ajsk.com/openings/',
  'https://www.ajsk.com/karriere/',
  'https://www.ajsk.com/stellen/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|’)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions\b/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjobs at\b/i,
  /\bwork with us\b/i,
  /\boffene stellen\b/i,
  /\bstellenangebote\b/i,
  /\blever\.co\b/i,
  /\bgreenhouse\.io\b/i,
  /\bashbyhq\.com\b/i,
  /\bworkdayjobs\.com\b/i,
  /\bmyworkdayjobs\.com\b/i,
  /\bsmartrecruiters\.com\b/i,
  /\bjobvite\.com\b/i,
  /\bbreezy\.hr\b/i,
]

const CAREER_ROUTE_PATTERN = /\/(?:careers?|jobs?|join-us|work-with-us|openings|karriere|stellen)(?:[/?#]|$)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const hasAsciiOrUnicodePhrase = (text, regex) => regex.test(normalizeWhitespace(text))

const isCareerLikePageEntry = (page = {}) => {
  const slug = String(page?.slug ?? '')
  const link = String(page?.link ?? '')
  const title = String(page?.title?.rendered ?? '')

  return CAREER_ROUTE_PATTERN.test(`/${slug}/`)
    || CAREER_ROUTE_PATTERN.test(link)
    || /\b(careers?|jobs?|join us|work with us|openings|karriere|stellen)\b/i.test(title)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*AJSK GmbH\s*<\/title>/i.test(page)
    && text.includes('Herzlich willkommen bei der AJSK GmbH!')
    && text.includes('Gesundheit und Wellness')
    && hasAsciiOrUnicodePhrase(text, /\b(fuehrendes|führendes)\s+Unternehmen\b/i)
    && hasAsciiOrUnicodePhrase(text, /\bNahrungsergaenzungsmittel|Nahrungsergänzungsmittel\b/i)
    && text.includes('Jetzt einkaufen bei Montcalia.ch')
    && text.includes('AJSK GmbH')
    && text.includes('GeneratePress')
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasCareerRouteLinkSignal = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (!absoluteUrl) continue

    try {
      const parsed = new URL(absoluteUrl)
      if (parsed.origin !== new URL(HOMEPAGE_URL).origin) continue
      if (CAREER_ROUTE_PATTERN.test(parsed.pathname)) return true
    } catch {
      continue
    }
  }

  return false
}

export const hasVerifiedPagesInventoryShape = (payload) => {
  if (!Array.isArray(payload)) return false

  const pages = payload.filter((page) => page && typeof page === 'object')
  const slugs = new Set(pages.map((page) => String(page.slug ?? '').toLowerCase()))
  const links = new Set(pages.map((page) => String(page.link ?? '')))

  return slugs.has('kontakt')
    && slugs.has('impressum')
    && slugs.has('home-4')
    && links.has(HOMEPAGE_URL)
    && links.has('https://www.ajsk.com/kontakt/')
    && links.has('https://www.ajsk.com/impressum/')
    && !pages.some(isCareerLikePageEntry)
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeWhitespace(html)

  return Number(page?.status) === 404
    && /<title>\s*Seite nicht gefunden(?:\s*&#8211;|\s*[–-])\s*AJSK GmbH\s*<\/title>/i.test(html)
    && hasAsciiOrUnicodePhrase(text, /Hoppla!\s+Diese Seite konnte leider nicht gefunden werden\./i)
    && hasAsciiOrUnicodePhrase(text, /Wie w(?:ae|ä)re es mit einer Suche\?/i)
    && text.includes('AJSK GmbH')
    && text.includes('GeneratePress')
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

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createAJSKScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('AJSK verified official homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html) || hasCareerRouteLinkSignal(homepage.html)) {
      throw new Error('AJSK homepage now appears to expose a public jobs surface')
    }

    const pagesInventory = await fetchJson(PAGES_API_URL)
    if (!hasVerifiedPagesInventoryShape(pagesInventory)) {
      throw new Error('AJSK verified WordPress pages inventory changed materially or now exposes public careers')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`AJSK verified no-public-careers surface changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAJSKScraper().run(options)

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
