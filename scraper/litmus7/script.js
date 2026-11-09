import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'litmus7'
export const COMPANY = 'Litmus7 Systems Consulting Ltd'
export const HOMEPAGE_URL = 'https://www.litmus7.com/'
export const CAREERS_URL = 'https://www.litmus7.com/Career'

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

const HOMEPAGE_SIGNALS = [
  'your retail business results partner',
  'litmus7 systems consulting private limited',
]

const CAREER_SIGNALS = [
  'join our team of passionate innovators',
  'open positions',
  'no open positions',
  'share your resume',
  'litmus7 systems consulting',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjob openings\b/i,
  /href=["'][^"']*\/jobs?\/[^"']+["']/i,
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
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title[^>]*>\s*Litmus7\s*\|\s*Retail Technology\s*&amp;\s*AI Data Analytics Solutions\s*<\/title>/i.test(page)
    && /href=["'][^"']*\/Career["']/i.test(page)
    && /Litmus7 Systems Consulting/i.test(page)
    && HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasOfficialCareerSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title[^>]*>\s*Careers at Litmus7\s*\|\s*Join Our Retail Tech Innovators\s*<\/title>/i.test(page)
    && CAREER_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createLitmus7Scraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('Litmus7 verified official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200) {
      throw new Error('Litmus7 verified first-party careers page no longer matches the known zero-job surface')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Litmus7 careers page now appears to expose a public jobs surface')
    }

    if (!hasOfficialCareerSignal(careersPage.html)) {
      throw new Error('Litmus7 verified first-party careers page no longer matches the known zero-job surface')
    }

    return []
  },
})

export const run = async (options = {}) => createLitmus7Scraper().run(options)

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
