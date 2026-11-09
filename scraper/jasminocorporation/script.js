import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jasminocorporation'
export const COMPANY = 'Jasmino Corporation'
export const HOMEPAGE_URL = 'https://jasmino.com/'
export const CAREERS_ROUTE_URLS = [
  'https://jasmino.com/careers',
  'https://jasmino.com/careers/',
  'https://jasmino.com/career',
  'https://jasmino.com/career/',
  'https://jasmino.com/jobs',
  'https://jasmino.com/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_PATTERNS = [
  /jasmino corporation/i,
  /industrial process equipment/i,
  /surface protection/i,
]

const HTTP_404_PATTERN = /HTTP 404\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return HOMEPAGE_PATTERNS.every((pattern) => pattern.test(page))
}

export const isVerifiedMissingRouteError = (error, url) =>
  HTTP_404_PATTERN.test(String(error?.message ?? error))
  && String(error?.message ?? error).includes(url)

const validateNoPublicListings = (jobs) => {
  if (!Array.isArray(jobs) || jobs.length !== 0) {
    throw new Error('Jasmino Corporation scraper expected no public listings from the verified official surface')
  }

  return jobs
}

const assertVerifiedMissingRoute = async (fetchText, url) => {
  try {
    await fetchText(url)
  } catch (error) {
    if (isVerifiedMissingRouteError(error, url)) {
      return
    }

    throw error
  }

  throw new Error('Jasmino Corporation careers routes no longer match the verified public missing-route surface')
}

export const createJasminoCorporationScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Jasmino Corporation homepage no longer matches the verified official site')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      await assertVerifiedMissingRoute(fetchText, routeUrl)
    }

    return validateNoPublicListings([])
  },
})

export const run = async (options = {}) => createJasminoCorporationScraper().run(options)

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
