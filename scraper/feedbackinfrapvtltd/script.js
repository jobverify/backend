import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'feedbackinfrapvtltd'
export const COMPANY = 'Feedback Infra Pvt Ltd'
export const HOMEPAGE_URL = 'https://www.feedbackinfra.com/'
export const CAREERS_URL = 'https://www.feedbackinfra.com/career.php'
export const EXTERNAL_JOBS_HOST = 'companies.naukri.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*Feedback Infra\s*\|\s*Making Infrastructure Happen\s*<\/title>/i
const HOMEPAGE_TAGLINE_PATTERN = /India's Leading Integrated Infrastructure Services Company/i
const HOMEPAGE_CAREERS_LINK_PATTERN = /href=["'][^"']*career\.php["']/i
const INQUIRIES_EMAIL_PATTERN = /inquiries@feedbackinfra\.com/i

const CAREERS_TITLE_PATTERN = /<title>\s*Feedback Infra\s*\|\s*Making Infrastructure Happen\s*<\/title>/i
const LIFE_AT_FEEDBACK_PATTERN = /Life at Feedback/i
const CURRENT_OPENINGS_PATTERN = /Current Openings/i
const TWITTER_SECTION_PATTERN = /Feedback Infra on twitter/i
const NAUKRI_HANDOFF_PATTERN = /href=["']https?:\/\/companies\.naukri\.com\/[^"']*["']/i

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return HOMEPAGE_TITLE_PATTERN.test(page)
    && HOMEPAGE_TAGLINE_PATTERN.test(page)
    && HOMEPAGE_CAREERS_LINK_PATTERN.test(page)
    && INQUIRIES_EMAIL_PATTERN.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return CAREERS_TITLE_PATTERN.test(page)
    && LIFE_AT_FEEDBACK_PATTERN.test(page)
    && CURRENT_OPENINGS_PATTERN.test(page)
    && TWITTER_SECTION_PATTERN.test(page)
    && INQUIRIES_EMAIL_PATTERN.test(page)
}

export const hasExternalJobsHandoffSignal = (html) => {
  const page = String(html ?? '')
  return CURRENT_OPENINGS_PATTERN.test(page) && NAUKRI_HANDOFF_PATTERN.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFeedbackInfraScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Feedback Infra official homepage no longer matches the verified first-party surface')
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Feedback Infra official careers page no longer matches the verified first-party surface')
    }

    if (!hasExternalJobsHandoffSignal(careersHtml)) {
      throw new Error('Feedback Infra careers handoff changed; refusing to assume the verified external jobs route still applies')
    }

    return []
  },
})

export const run = async (options = {}) => createFeedbackInfraScraper().run(options)

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
