import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'keshavsoft'
export const COMPANY = 'KeshavSoft'
export const HOMEPAGE_URL = 'https://keshavsoft.com/'
export const INTERNSHIP_URL = 'https://keshavsoft.com/Students/HtmlFiles/registerForInternsV5.html'
export const MISSING_ROUTE_URLS = [
  'https://keshavsoft.com/careers',
  'https://keshavsoft.com/career',
  'https://keshavsoft.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'KeshavSoft',
  'Internship',
  'Software Developers',
  'Gold estimation',
]

const INTERNSHIP_SIGNALS = [
  'KeshavSoft - RegisterForInterns',
  'Register now',
  'Enter the below details to show your interest',
  'Select resume file',
  'Your Github Link',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob title\b/i,
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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, '\'')
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(normalizeWhitespace(signal).toLowerCase()))
}

export const hasVerifiedInternshipLink = (html) =>
  /href=["']\.\/Students\/HtmlFiles\/registerForInternsV5\.html["']/i.test(String(html ?? ''))

export const hasOfficialInternshipSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return INTERNSHIP_SIGNALS.every((signal) => normalized.includes(normalizeWhitespace(signal).toLowerCase()))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingRoute = (page = {}) =>
  Number(page?.status) === 404 && !hasPublicJobsSignal(page?.html)

export const createKeshavSoftScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html) || !hasVerifiedInternshipLink(homepage.html)) {
      throw new Error('KeshavSoft verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('KeshavSoft homepage now appears to expose public jobs')
    }

    const internshipPage = await fetchPage(INTERNSHIP_URL)
    if (internshipPage.status !== 200 || !hasOfficialInternshipSignal(internshipPage.html)) {
      throw new Error('KeshavSoft verified internship page no longer matches the known first-party interest form')
    }

    if (hasPublicJobsSignal(internshipPage.html)) {
      throw new Error('KeshavSoft internship page now appears to expose public jobs')
    }

    for (const routeUrl of MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage)) {
        throw new Error('KeshavSoft missing first-party careers routes changed materially')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createKeshavSoftScraper().run(options)

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
