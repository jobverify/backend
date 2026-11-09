import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'neccorporation'
export const COMPANY = 'NEC Corporation'
export const VERIFIED_ON = '2026-08-03'
export const HOMEPAGE_URL = 'https://www.nec.com/'
export const SITEMAP_URL = 'https://www.nec.com/sitemap.xml'
export const CAREERS_URL = 'https://www.nec.com/en/global/rd/rd-recruit/index.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&copy;/gi, '©')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: 3,
    baseDelayMs: 2000,
    timeoutMs: 20000,
    label: SOURCE,
  })

const HOMEPAGE_SIGNALS = [
  'nec(global)',
  'empower humanity',
  'delivering innovation and peace of mind',
  'vision for creating social value',
  'about nec',
]

const CAREERS_SIGNALS = [
  'are you interested in working at our laboratories?',
  'research & development',
  'nec laboratories are looking for aspiring individuals who want to improve society and make people\'s lives better.',
  'our researchers',
  'achievements',
  'publications',
  'r&d(japanese)',
]

const CAREER_SURFACE_PATTERN =
  /(?:^|[\/_.-])(careers?|recruit(?:ment)?|employment|hiring|vacanc(?:y|ies)|openings|positions|jobs?)(?:[\/_.-]|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /\bjob search\b/i,
  /\bjob list(?:ing|ings)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
]

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return CAREERS_SIGNALS.every((signal) => normalized.includes(signal))
}

export const pageExposesPublicJobListings = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractCareerSurfaceUrls = (sitemapXml) => {
  const urls = [...String(sitemapXml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .filter((url) => CAREER_SURFACE_PATTERN.test(url))

  return [...new Set(urls)]
}

const hasVerifiedCareerSurfaceSet = (sitemapXml) => {
  const matches = extractCareerSurfaceUrls(sitemapXml)
  return matches.length === 1 && matches[0] === CAREERS_URL
}

export const createNecCorporationScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('The official NEC Corporation homepage no longer matches the verified first-party surface')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    if (!hasVerifiedCareerSurfaceSet(sitemapXml)) {
      throw new Error('The NEC Corporation sitemap no longer matches the verified single-surface recruit contract')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The official NEC Corporation recruit page no longer matches the verified zero-job surface')
    }

    if (pageExposesPublicJobListings(careersHtml)) {
      throw new Error('The official NEC Corporation recruit page appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createNecCorporationScraper().run(options)

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
