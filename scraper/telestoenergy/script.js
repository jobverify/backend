import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'telestoenergy'
export const COMPANY = 'Telesto Energy'
export const HOMEPAGE_URL = 'https://www.telestoenergy.com/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.telestoenergy.com/careers',
  'https://www.telestoenergy.com/careers/',
  'https://www.telestoenergy.com/career',
  'https://www.telestoenergy.com/career/',
  'https://www.telestoenergy.com/jobs',
  'https://www.telestoenergy.com/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u2014/g, '-')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const OFFICIAL_SITE_TEXT_PATTERNS = [
  /telesto energy/i,
  /global capability centre for subsurface/i,
  /ai-driven subsurface intelligence/i,
]

const OFFICIAL_SITE_LINK_PATTERNS = [
  /mailto:contact@telestoenergy\.com/i,
  /https:\/\/sg\.linkedin\.com\/company\/telesto-energy/i,
]

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
    html: await response.text(),
  }
}

export const hasOfficialSiteSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return OFFICIAL_SITE_TEXT_PATTERNS.every((pattern) => pattern.test(normalized))
    && OFFICIAL_SITE_LINK_PATTERNS.every((pattern) => pattern.test(rawHtml))
}

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createTelestoEnergyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialSiteSignal(homepage.html)) {
      throw new Error('Telesto Energy official homepage no longer matches the verified official homepage')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(
          `Telesto Energy route ${routePage.url || routeUrl} no longer matches the verified no-public-careers surface`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTelestoEnergyScraper().run(options)

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
