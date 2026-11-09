import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'clearquote'
export const COMPANY = 'ClearQuote'
export const HOMEPAGE_URL = 'https://clearquote.io/'
export const PAGE_SITEMAP_URL = 'https://clearquote.io/page-sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://clearquote.io/careers',
  'https://clearquote.io/careers/',
  'https://clearquote.io/jobs',
  'https://clearquote.io/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_URL_PATTERN = /\/(?:careers?|jobs?)(?:\/|$|[?#])/i
const PUBLIC_JOBS_TEXT_PATTERNS = [
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bopen roles?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjoin our team\b/i,
]

const PUBLIC_JOBS_RAW_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#8211;|&#x2013;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,text/plain;q=0.7,*/*;q=0.6',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOBS_TEXT_PATTERNS.some((pattern) => pattern.test(normalized))
    || PUBLIC_JOBS_RAW_PATTERNS.some((pattern) => pattern.test(page))
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title[^>]*>[\s\S]*ClearQuote[\s\S]*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/clearquote\.io\/"/i.test(page)
    && normalized.includes('clearquote')
    && (
      normalized.includes('used car')
      || normalized.includes('fleet damage')
      || normalized.includes('commercial and rental fleets')
    )
}

export const hasOfficialPageSitemapSignal = (xml) => {
  const urls = extractSitemapUrls(xml)

  return urls.some((url) => /^https:\/\/clearquote\.io\/?$/i.test(url))
    && urls.some((url) => /^https:\/\/clearquote\.io\/privacy-policy\/?$/i.test(url))
    && urls.every((url) => {
      try {
        return new URL(url).hostname === 'clearquote.io'
      } catch {
        return false
      }
    })
    && !urls.some((url) => CAREER_LIKE_URL_PATTERN.test(url))
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(page?.status) === 404
    && /<title>\s*Page not found\s*-\s*ClearQuote\s*<\/title>/i.test(html)
    && normalized.includes('page not found')
    && normalized.includes('clearquote')
    && !hasPublicJobsSignal(html)
  }

export const createClearQuoteScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('ClearQuote verified homepage no longer matches the known first-party surface')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (
      pageSitemap.status !== 200
      || !hasOfficialPageSitemapSignal(pageSitemap.html)
      || hasPublicJobsSignal(pageSitemap.html)
    ) {
      throw new Error('ClearQuote verified page sitemap no longer matches the known first-party surface')
    }

    for (const url of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const page = await fetchPage(url)
      if (!isVerifiedMissingCareerRoute(page)) {
        throw new Error(`ClearQuote no-public-careers route changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createClearQuoteScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
