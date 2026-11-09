import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.skillovilla.com/'
export const CAREERS_ROUTE_URL = 'https://www.skillovilla.com/careers'
export const JOBS_ROUTE_URL = 'https://www.skillovilla.com/jobs'

const SOURCE = 'skillovilla'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const HTTP_404_PATTERN = /HTTP 404\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')

  return /^Data Analytics & Data Science Courses Online \| SkilloVilla$/i.test(title)
    && normalized.includes('Your upskilling partner')
    && normalized.includes('Land your dream job by learning from the top 1%')
}

export const isVerifiedMissingRouteError = (error, url) =>
  HTTP_404_PATTERN.test(String(error?.message ?? error))
  && String(error?.message ?? error).includes(url)

const validateNoPublicListings = (jobs) => {
  if (!Array.isArray(jobs) || jobs.length !== 0) {
    throw new Error('SkilloVilla scraper expected no public listings from the verified official surface')
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

  throw new Error('SkilloVilla careers routes no longer match the verified public missing-route surface')
}

export const createSkilloVillaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('SkilloVilla homepage no longer matches the verified official site')
    }

    await assertVerifiedMissingRoute(fetchText, CAREERS_ROUTE_URL)
    await assertVerifiedMissingRoute(fetchText, JOBS_ROUTE_URL)

    return validateNoPublicListings([])
  },
})

export const run = async (options = {}) => createSkilloVillaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running SkilloVilla scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
