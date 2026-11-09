import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.digitalbackoffice.com/'
export const JOBS_PAGE_URL = 'https://www.digitalbackoffice.com/it-jobs/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const BRAND_PATTERN = /\bDigital Back Office\b/i
const CONTACT_TITLE_PATTERN = /Contact An IT Professional/i
const CONTACT_ROUTE_PATTERN = /contact-it-professional/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs|\/jobs\/apply\/\d+|job openings|current openings|open positions|employment opportunities|career opportunities|join our team/i

export const hasOfficialDigitalBackOfficeSignal = (html) => BRAND_PATTERN.test(String(html ?? ''))

export const hasVerifiedContactRouteSignal = (html) => {
  const page = String(html ?? '')
  return CONTACT_TITLE_PATTERN.test(page) && CONTACT_ROUTE_PATTERN.test(page)
}

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'digitalbackoffice',
  timeoutMs: 15000,
})

export const createDigitalBackOfficeScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)

    if (!hasOfficialDigitalBackOfficeSignal(homepageHtml)) {
      throw new Error('Digital Back Office official public site changed; refusing to assume no public listings')
    }

    if (hasPublicJobBoardSignal(homepageHtml) || hasPublicJobBoardSignal(jobsPageHtml)) {
      throw new Error('Digital Back Office public site now appears to expose job listings')
    }

    if (!hasVerifiedContactRouteSignal(jobsPageHtml)) {
      throw new Error('Digital Back Office jobs route no longer matches the verified contact-form surface')
    }

    return []
  },
})

export const run = async (options = {}) => createDigitalBackOfficeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'digitalbackoffice')
  }
}
