import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'turso'
export const COMPANY = 'Turso'
export const VERIFIED_ON = '2026-07-25'
export const HOMEPAGE_URL = 'https://turso.tech/'
export const CAREERS_PAGE_URL = 'https://turso.tech/careers'
export const TERMS_OF_USE_URL = 'https://turso.tech/terms-of-use'
export const TURSO_ASHBY_BOARD_URL = 'https://jobs.ashbyhq.com/turso'
export const CHISELSTRIKE_ASHBY_BOARD_URL = 'https://jobs.ashbyhq.com/chiselstrike'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? '').trim())
    url.hash = ''
    url.search = ''

    if (!url.pathname || url.pathname === '/') {
      return `${url.origin}/`
    }

    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

const defaultFetchPage = (url, { signal } = {}) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    finalUrl: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
  signal,
})

export const hasVerifiedLegalIdentitySignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title[^>]*>\s*Turso Terms of Use\s*<\/title>/i.test(page)
    && text.includes('support@turso.tech')
    && text.includes('2093 Philadelphia Pike, #6336 Claymont, Delaware 19703 United States')
    && /CHISELSTRIKE INC\./i.test(text)
    && /Turso/i.test(text)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const hasVerifiedTitle = /<title[^>]*>\s*Turso\s*-\s*(?:Databases Everywhere|Millions of Databases\. One Architecture\.)\s*<\/title>/i.test(page)
  const hasVerifiedHeroCopy = text.includes('Millions of Databases. One Architecture.')
    && (
      text.includes('Built on SQLite. Lightweight enough to multiply, fast enough to run anywhere.')
      || text.includes('Built on SQLite. Fast and lightweight to multiply and run anywhere.')
    )

  return hasVerifiedTitle
    && hasVerifiedHeroCopy
    && text.includes('Company')
    && text.includes('About')
    && text.includes('Contact Us')
}

export const isRedirectedToVerifiedHomepage = ({ finalUrl, html } = {}) =>
  normalizeComparableUrl(finalUrl) === normalizeComparableUrl(HOMEPAGE_URL)
  && hasOfficialHomepageSignal(html)

export const hasUnconfiguredAshbyBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Jobs\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,nofollow["']/i.test(page)
    && /window\.__appData\s*=\s*\{[\s\S]*"organization"\s*:\s*null[\s\S]*"posting"\s*:\s*null[\s\S]*"jobBoard"\s*:\s*null[\s\S]*\}/i.test(page)
}

export const createTursoScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const termsPage = await fetchPage(TERMS_OF_USE_URL)
    if (!hasVerifiedLegalIdentitySignal(termsPage?.html)) {
      throw new Error('Verified Turso legal identity changed materially')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (!isRedirectedToVerifiedHomepage(careersPage)) {
      throw new Error('Verified Turso careers route no longer redirects to the homepage')
    }

    const tursoBoardPage = await fetchPage(TURSO_ASHBY_BOARD_URL)
    if (!hasUnconfiguredAshbyBoardSignal(tursoBoardPage?.html)) {
      throw new Error('Verified Turso public Ashby board shell changed materially')
    }

    const chiselstrikeBoardPage = await fetchPage(CHISELSTRIKE_ASHBY_BOARD_URL)
    if (!hasUnconfiguredAshbyBoardSignal(chiselstrikeBoardPage?.html)) {
      throw new Error('Verified ChiselStrike public Ashby board shell changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createTursoScraper().run(options)

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
