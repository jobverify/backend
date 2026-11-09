import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'relianceretail'
export const COMPANY = 'Reliance Retail'
export const HOMEPAGE_URL = 'https://www.relianceretail.com/'
export const NO_PUBLIC_ROUTE_URLS = [
  'https://www.relianceretail.com/careers',
  'https://www.relianceretail.com/careers/',
  'https://www.relianceretail.com/career',
  'https://www.relianceretail.com/career/',
  'https://www.relianceretail.com/jobs',
  'https://www.relianceretail.com/jobs/',
  'https://www.relianceretail.com/join-us',
  'https://www.relianceretail.com/join-us/',
  'https://www.relianceretail.com/openings',
  'https://www.relianceretail.com/openings/',
  'https://www.relianceretail.com/sitemap.xml',
  'https://www.relianceretail.com/robots.txt',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/www\.relianceretail\.com)?\/(?:careers?|jobs?|openings|join-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&rsquo;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) =>
  decodeHtmlEntities(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePathname = (value) => {
  try {
    const pathname = new URL(value).pathname
    return pathname !== '/' ? pathname.replace(/\/$/, '') : pathname
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasUnexpectedCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Reliance Retail Ltd India')
    && normalized.includes('largest retailer')
    && normalized.includes('Reliance Retail Customer First')
    && normalized.includes("Building India's largest retail company")
    && normalized.includes('Delivering Happiness')
    && normalized.includes('Building a billion relationships')
    && normalized.includes('Since its inception in 2006, Reliance Retail has grown to become India')
    && normalized.includes('largest retailer delivering superior value to its customers, suppliers and shareholders.')
}

export const isVerifiedMissingRoute = (page = {}, expectedUrl = '') => {
  const normalized = normalizeWhitespace(page?.html)
  const actualPath = normalizePathname(page?.url || expectedUrl)
  const expectedPath = normalizePathname(expectedUrl)

  return Number(page?.status) === 404
    && Boolean(actualPath)
    && actualPath === expectedPath
    && normalized.includes('404 - File or directory not found.')
    && normalized.includes('Server Error')
    && normalized.includes('The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.')
    && !hasUnexpectedCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const createRelianceRetailScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Reliance Retail verified official homepage no longer matches the known first-party surface')
    }
    if (hasUnexpectedCareerLikeLink(homepage.html)) {
      throw new Error('Reliance Retail homepage now exposes a first-party careers path')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Reliance Retail homepage now appears to expose a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage, routeUrl)) {
        throw new Error(
          `Reliance Retail missing first-party route changed or now exposes a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createRelianceRetailScraper().run(options)

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
