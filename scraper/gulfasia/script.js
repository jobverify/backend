import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://gulfasia.com/'
export const CAREERS_URL = 'https://gulfasia.com/careers'
export const JOBS_URL = 'https://gulfasia.com/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PARKED_TITLE_PATTERN =
  /<title>\s*gulfasia\.com[\s\S]*?This website is for sale![\s\S]*?gulfasia Resources and Information\.\s*<\/title>/i
const PARKED_DESCRIPTION_PATTERN =
  /This website is for sale!\s*gulfasia\.com is your first and best source for information about gulfasia\./i
const SEDO_LOGO_PATTERN = /img\.sedoparking\.com\/templates\/logos\/sedo_logo\.png/i
const PARKED_SCRIPT_PATTERN = /euob\.iseaskies\.com\/sxp\/i\/581749a3c1e7922374ca9b3d4dff0407\.js/i
const PARKED_CHEQ_PATTERN = /CHEQ_BLOCKED_REASONS/i
const PUBLIC_JOB_BOARD_PATTERN =
  /\b(open roles|open positions|current openings|job openings|available positions|apply now|apply here|join our team|we are hiring|careers at)\b|jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs/i

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export const hasParkedDomainSignal = (html) => {
  const page = String(html ?? '')

  return PARKED_TITLE_PATTERN.test(page)
    && PARKED_DESCRIPTION_PATTERN.test(page)
    && SEDO_LOGO_PATTERN.test(page)
    && (PARKED_SCRIPT_PATTERN.test(page) || PARKED_CHEQ_PATTERN.test(page))
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(normalizeWhitespace(html))

export const matchesVerifiedNoJobsSurface = (homepageHtml, careersHtml, jobsHtml) =>
  hasParkedDomainSignal(homepageHtml)
  && hasParkedDomainSignal(careersHtml)
  && hasParkedDomainSignal(jobsHtml)

export const validateJobResults = (jobs) => {
  if (!Array.isArray(jobs)) {
    throw new TypeError('Gulf Asia scraper must return an array of jobs')
  }

  for (const job of jobs) {
    if (!job || typeof job !== 'object') {
      throw new TypeError('Gulf Asia scraper returned a non-object job entry')
    }
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'gulfasia',
  timeoutMs: 15000,
})

export const createGulfAsiaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasParkedDomainSignal(homepageHtml)) {
      throw new Error('Gulf Asia homepage no longer matches the verified parked public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobsHtml = await fetchText(JOBS_URL)

    if (hasPublicJobBoardSignal(homepageHtml)
      || hasPublicJobBoardSignal(careersHtml)
      || hasPublicJobBoardSignal(jobsHtml)) {
      throw new Error('Gulf Asia public careers surface now appears to expose job listings')
    }

    if (!matchesVerifiedNoJobsSurface(homepageHtml, careersHtml, jobsHtml)) {
      throw new Error('Gulf Asia public routes no longer match the verified parked no-jobs surface')
    }

    return validateJobResults([])
  },
})

export const run = async () => createGulfAsiaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Gulf Asia scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'gulfasia')
    console.log('DB result:', result)
    process.exit(0)
  }
}
