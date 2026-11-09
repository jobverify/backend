import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'placifytechnologies'
export const COMPANY = 'Placify Technologies'
export const HOMEPAGE_URL = 'https://placifytechnologies.in/'
export const SITEMAP_URL = 'https://placifytechnologies.in/sitemap_index.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://placifytechnologies.in/careers',
  'https://placifytechnologies.in/careers/',
  'https://placifytechnologies.in/career',
  'https://placifytechnologies.in/career/',
  'https://placifytechnologies.in/jobs',
  'https://placifytechnologies.in/jobs/',
  'https://placifytechnologies.in/join-us',
  'https://placifytechnologies.in/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_SIGNAL_PATTERN =
  /\b(careers|jobs|current openings|open positions|job openings|vacancies|join us|work with us|we(?:'|&#0*39;)?re hiring|hiring now)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const OFFICIAL_HOMEPAGE_TEXT_PATTERNS = [
  /Home - Placify Technologies/i,
  /Building Smart Digital Solutions for Modern Businesses/i,
  /Placify Technologies helps startups, businesses, and enterprises turn ideas into powerful digital products\s*\./i,
  /Get a Free Quote/i,
]

const OFFICIAL_HOMEPAGE_RAW_PATTERNS = [
  /href="https:\/\/placifytechnologies\.in\/services\/"/i,
  /href="https:\/\/placifytechnologies\.in\/certification\/"/i,
  /href="https:\/\/placifytechnologies\.in\/about-us\/"/i,
  /href="https:\/\/placifytechnologies\.in\/blog\/"/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return OFFICIAL_HOMEPAGE_TEXT_PATTERNS.every((pattern) => pattern.test(normalized))
    && OFFICIAL_HOMEPAGE_RAW_PATTERNS.every((pattern) => pattern.test(rawHtml))
}

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []
  return matches.some((entry) => CAREERS_SIGNAL_PATTERN.test(entry))
}

export const pageHasCareersSignal = (html) => CAREERS_SIGNAL_PATTERN.test(normalizeWhitespace(html))

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const isRuntimeBlockedPlacifyPage = (page = {}, expectedUrl = HOMEPAGE_URL) =>
  Number(page?.status) === 444
  && String(page?.url || expectedUrl).startsWith('https://placifytechnologies.in/')
  && normalizeWhitespace(page?.html || '') === ''

export const isRuntimeDegradedPlacifyHomepage = (page = {}, expectedUrl = HOMEPAGE_URL) => {
  const rawHtml = String(page?.html || '')
  const normalized = normalizeWhitespace(page?.html || '')

  return Number(page?.status) === 500
    && String(page?.url || expectedUrl).startsWith('https://placifytechnologies.in/')
    && /Home - Placify Technologies/i.test(normalized)
    && /Building Smart Digital Solutions for Modern Businesses/i.test(rawHtml)
    && /critical error on this website/i.test(rawHtml)
}

export const isRuntimeDegradedPlacifyMissingRoute = (page = {}, expectedUrl = HOMEPAGE_URL) => {
  const rawHtml = String(page?.html || '')
  const normalized = normalizeWhitespace(page?.html || '')

  return Number(page?.status) === 500
    && String(page?.url || expectedUrl).startsWith('https://placifytechnologies.in/')
    && /Page not found - Placify Technologies/i.test(normalized)
    && /critical error on this website/i.test(rawHtml)
    && !pageHasCareersSignal(rawHtml)
}

export const createPlacifyTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    const homepageBlocked = isRuntimeBlockedPlacifyPage(homepage, HOMEPAGE_URL)
    const homepageDegraded = isRuntimeDegradedPlacifyHomepage(homepage, HOMEPAGE_URL)

    if (!homepageBlocked && !homepageDegraded && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Placify Technologies verified official homepage no longer matches the known public surface')
    }

    if (!homepageBlocked && pageHasCareersSignal(homepage.html)) {
      throw new Error('Placify Technologies homepage now appears to expose a public careers signal')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    const sitemapBlocked = isRuntimeBlockedPlacifyPage(sitemap, SITEMAP_URL)
    if (!sitemapBlocked && (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html))) {
      throw new Error('Placify Technologies verified sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (
        !isMissingCareerRoute(routePage)
        && !isRuntimeBlockedPlacifyPage(routePage, routeUrl)
        && !isRuntimeDegradedPlacifyMissingRoute(routePage, routeUrl)
      ) {
        throw new Error(
          `Placify Technologies verified no-public-careers route changed: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPlacifyTechnologiesScraper().run(options)

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
