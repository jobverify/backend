import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mayacardio'
export const COMPANY = 'MayaCardio'
export const HOMEPAGE_URL = 'https://mayacardio.com/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://mayacardio.com/careers',
  'https://mayacardio.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'mayacardio',
  'majahealth',
  'ai-powered cardiovascular monitoring',
  'empowering health & well being.',
  'beats@majahealth.io',
  'new jersey and new delhi',
]

const NO_PUBLIC_JOBS_ROUTE_SIGNALS = [
  'mayacardio',
  'empowering health & well being.',
  'beats@majahealth.io',
  'new jersey and new delhi',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
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

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  if (Number(page?.status) !== 200) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  const normalized = normalizeWhitespace(page?.html).toLowerCase()
  return NO_PUBLIC_JOBS_ROUTE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const createMayacardioScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('MayaCardio verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('MayaCardio homepage now appears to expose a public jobs surface')
    }

    for (const careersRouteUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedNoPublicJobsRoute(careersRoute)) {
        throw new Error('MayaCardio careers/jobs routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMayacardioScraper().run(options)

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
