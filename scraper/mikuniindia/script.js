import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mikuniindia'
export const COMPANY = 'Mikuni India Private Limited'
export const HOMEPAGE_URL = 'https://mikuni.co.in/'
export const CAREERS_URL = 'https://mikuni.co.in/open-positions-linked-with-naukri-portal/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
]

const HOMEPAGE_SIGNALS = [
  'mikuni india private limited',
  'about us',
  'career',
  'sales@mikuni.co.in',
  'mikuni group',
]

const CAREER_SIGNALS = [
  'open positions @ mikuni india',
  'apply here',
  'first name',
  'willing to relocate to neemrana',
  'submit',
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

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return normalized.includes(HOMEPAGE_SIGNALS[0])
    && HOMEPAGE_SIGNALS.slice(1).some((signal) => normalized.includes(signal))
}

export const hasOfficialCareerSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return CAREER_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createMikuniIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Mikuni India verified official homepage no longer matches the known public surface')
    }

    const careers = await fetchPage(CAREERS_URL)
    if (careers.status !== 200 || !hasOfficialCareerSignal(careers.html)) {
      throw new Error('Mikuni India verified first-party careers page no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html) || hasPublicJobsSignal(careers.html)) {
      throw new Error('Mikuni India now appears to expose a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createMikuniIndiaScraper().run(options)

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
