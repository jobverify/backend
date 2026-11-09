import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'graymobility'
export const COMPANY = 'Gray Mobility'
export const HOMEPAGE_URL = 'https://graymobility.com/'
export const CAREERS_ROUTE_URLS = [
  'https://graymobility.com/careers',
  'https://graymobility.com/careers/',
  'https://graymobility.com/career',
  'https://graymobility.com/career/',
  'https://graymobility.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  '<title>graymobility.com</title>',
  'meta name="author" content="gray mobility"',
  'meta property="og:site_name" content="gray mobility"',
  'launching soon',
  'contact us',
  'copyright © 2025 gray mobility - all rights reserved.',
]

const NOT_FOUND_SIGNALS = [
  'page not found',
  'we can’t seem to find the page you’re looking for.',
  'go to home page',
  'copyright © 2025 gray mobility - all rights reserved.',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
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

export const isGraymobilityVerifiedTimeoutBlocker = (error) =>
  /connect timeout error|timed out|timeout|fetch failed|getaddrinfo|err_connection_timed_out|other side closed|terminated/i
    .test(String(error?.message ?? error?.cause?.message ?? error ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const normalized = String(html ?? '').toLowerCase()
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  const normalized = normalizeWhitespace(page?.html).toLowerCase()
  return NOT_FOUND_SIGNALS.every((signal) => normalized.includes(signal))
}

export const createGraymobilityScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)

      if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
        throw new Error('Graymobility verified official homepage no longer matches the known public surface')
      }

      if (hasPublicJobsSignal(homepage.html)) {
        throw new Error('Graymobility homepage now appears to expose a public jobs surface')
      }

      for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
        const careersRoute = await fetchPage(careersRouteUrl)

        if (!isVerifiedMissingCareersRoute(careersRoute)) {
          throw new Error('Graymobility careers routes changed materially or now expose public jobs')
        }
      }

      return []
    } catch (error) {
      if (isGraymobilityVerifiedTimeoutBlocker(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createGraymobilityScraper().run(options)

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
