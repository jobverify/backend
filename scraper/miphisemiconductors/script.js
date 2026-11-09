import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'miphisemiconductors'
export const COMPANY = 'MiPhi Semiconductors'
export const HOMEPAGE_URL = 'https://www.miphi.in/'
export const SITEMAP_URL = 'https://www.miphi.in/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.miphi.in/careers',
  'https://www.miphi.in/careers/',
  'https://www.miphi.in/career',
  'https://www.miphi.in/career/',
  'https://www.miphi.in/jobs',
  'https://www.miphi.in/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job|jobs|opening|openings|vacancy|vacancies|join us|work with us|hiring)\b/i

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
  /Bringing Storage IC Design and Manufacturing to India/i,
  /transforming semiconductor memory design and manufacturing in India/i,
  /leading Indian semiconductor company from its inception/i,
  /Make in India/i,
]

const OFFICIAL_HOMEPAGE_RAW_PATTERNS = [
  /Powered by Phison/i,
  /Enhanced by Micromax/i,
]

const OFFICIAL_HOMEPAGE_CURRENT_OR_LEGACY_PATTERNS = [
  /inquire@miphi\.in/i,
  /Secure Data Storage & SSDs India/i,
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
    && OFFICIAL_HOMEPAGE_CURRENT_OR_LEGACY_PATTERNS.some((pattern) =>
      pattern.test(rawHtml) || pattern.test(normalized),
    )
}

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []
  return matches.some((entry) => CAREERS_SIGNAL_PATTERN.test(entry))
}

export const pageHasCareersSignal = (html) => CAREERS_SIGNAL_PATTERN.test(normalizeWhitespace(html))

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createMiPhiSemiconductorsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('MiPhi Semiconductors verified official homepage no longer matches the known public surface')
    }

    if (pageHasCareersSignal(homepage.html)) {
      throw new Error('MiPhi Semiconductors homepage now appears to expose a public careers signal')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('MiPhi Semiconductors verified sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(
          `MiPhi Semiconductors verified no-public-careers route changed: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMiPhiSemiconductorsScraper().run(options)

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
