import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lightformsltd'
export const COMPANY = 'Light Forms Ltd'
export const HOMEPAGE_URL = 'https://www.lightforms.com/'
export const CONTACT_PAGE_URL = 'https://www.lightforms.com/contact/'
export const CAREERS_ROUTE_URL = 'https://www.lightforms.com/careers/'
export const JOBS_ROUTE_URL = 'https://www.lightforms.com/jobs/'
export const WORK_WITH_US_ROUTE_URL = 'https://www.lightforms.com/work-with-us/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*Light Forms\s*-\s*Made to Measure Lighting Solutions\s*<\/title>/i
const HOMEPAGE_DESCRIPTION_PATTERN =
  /Light Forms creates high performance, technically advanced and elegantly designed lighting solutions/i
const HOMEPAGE_LEGAL_NAME_PATTERN = /\bLight Forms Ltd\b/i
const HOMEPAGE_ASIA_PATTERN = /\bLight Forms Asia\b/i

const CONTACT_TITLE_PATTERN = /<title>\s*Contact Us\s*\|\s*Light Forms\s*<\/title>/i
const CONTACT_ASIA_SALES_PATTERN = />\s*Light Forms Asia Sales Office\s*<\/h3>/i
const CONTACT_ASK_EMAIL_PATTERN = /\bask@lightforms\.com\b/i
const CONTACT_WORK_WITH_US_EMAIL_PATTERN = /name=["']work_with_us_email["']/i
const CONTACT_WORK_WITH_US_MESSAGE_PATTERN = /name=["']work_with_us_message["']/i
const CONTACT_COMMENTED_CAREERS_LINK_PATTERN =
  /<!--\s*<a href=["']careers\/["'][^>]*>\s*Careers\s*<\/a>\s*<br\s*\/?>\s*-->/i

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

  return HOMEPAGE_TITLE_PATTERN.test(page)
    && HOMEPAGE_DESCRIPTION_PATTERN.test(page)
    && HOMEPAGE_LEGAL_NAME_PATTERN.test(page)
    && HOMEPAGE_ASIA_PATTERN.test(page)
}

export const hasContactPageSignal = (html) => {
  const page = String(html ?? '')

  return CONTACT_TITLE_PATTERN.test(page)
    && CONTACT_ASIA_SALES_PATTERN.test(page)
    && CONTACT_ASK_EMAIL_PATTERN.test(page)
    && CONTACT_WORK_WITH_US_EMAIL_PATTERN.test(page)
    && CONTACT_WORK_WITH_US_MESSAGE_PATTERN.test(page)
    && CONTACT_COMMENTED_CAREERS_LINK_PATTERN.test(page)
}

export const isVerifiedMissingRouteError = (error, url) =>
  HTTP_404_PATTERN.test(String(error?.message ?? error))
  && String(error?.message ?? error).includes(url)

const validateNoPublicListings = (jobs) => {
  if (!Array.isArray(jobs) || jobs.length !== 0) {
    throw new Error('Light Forms scraper expected no public listings from the verified official surface')
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

  throw new Error('Light Forms careers routes no longer match the verified public missing-route surface')
}

export const createLightFormsLtdScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Light Forms homepage no longer matches the verified official site')
    }

    const contactHtml = await fetchText(CONTACT_PAGE_URL)

    if (!hasContactPageSignal(contactHtml)) {
      throw new Error('Light Forms contact page no longer matches the verified work-with-us surface')
    }

    await assertVerifiedMissingRoute(fetchText, CAREERS_ROUTE_URL)
    await assertVerifiedMissingRoute(fetchText, JOBS_ROUTE_URL)
    await assertVerifiedMissingRoute(fetchText, WORK_WITH_US_ROUTE_URL)

    return validateNoPublicListings([])
  },
})

export const run = async (options = {}) => createLightFormsLtdScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
