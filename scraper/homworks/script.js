import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.homworks.com/'
export const CAREERS_URL = 'https://www.homworks.com/careers-homworks/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_BRAND_PATTERN = /\bHomworks\b/i
const CAREERS_PATTERN = /\bCAREERS\b/i
const APPLY_FORM_PATTERN = /Apply Now|Full Name\*|Email Address\*|Phone Number\*|Subject\*|Submit Details/i
const LEGACY_CONTACT_SIGNAL_PATTERN = /mailto:\[email protected\]|PWDS Extrusions Pvt Ltd/i
const CURRENT_TITLE_PATTERN = /<title>\s*Careers\s*\|\s*Join Our Interior Design Team\s*\|\s*Homworks\s*<\/title>/i
const CURRENT_WELCOME_PATTERN = /Welcome to Homworks!/i
const CURRENT_CONTACT_COPY_PATTERN = /Take the Next Step in Your Career,\s*Contact Us Today!/i
const CURRENT_COMPANY_SIGNAL_PATTERN = /Homworks-Stylcove|STYLCOVE MODULARS PRIVATE LIMITED/i
const PUBLIC_JOB_BOARD_PATTERN =
  /boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|workdayjobs|smartrecruiters|job openings|current openings|open positions|vacancies|job[-_\s]?id/i

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  const hasLegacyContactSignals = LEGACY_CONTACT_SIGNAL_PATTERN.test(page)
  const hasCurrentContactSignals =
    CURRENT_TITLE_PATTERN.test(page)
    && CURRENT_WELCOME_PATTERN.test(page)
    && CURRENT_CONTACT_COPY_PATTERN.test(page)
    && CURRENT_COMPANY_SIGNAL_PATTERN.test(page)

  return OFFICIAL_BRAND_PATTERN.test(page)
    && CAREERS_PATTERN.test(page)
    && APPLY_FORM_PATTERN.test(page)
    && (hasLegacyContactSignals || hasCurrentContactSignals)
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const buildSearchUrl = () => CAREERS_URL

export const extractSearchResults = () => []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'homworks',
  timeoutMs: 15000,
})

export const createHomworksScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(buildSearchUrl())

    if (hasPublicJobBoardSignal(html)) {
      throw new Error('Homworks careers page now appears to expose public job listings')
    }

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Homworks careers page no longer matches the verified official public surface')
    }

    return extractSearchResults(normalizeWhitespace(html))
  },
})

export const run = async (options = {}) => createHomworksScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'homworks')
  }
}
