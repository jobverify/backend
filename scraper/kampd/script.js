import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kampd'
export const COMPANY = 'Kampd'
export const HOMEPAGE_URL = 'https://www.kampd.com/'
export const FAQ_URL = 'https://www.kampd.com/faq/'
export const CAREERS_ROUTE_URLS = [
  'https://www.kampd.com/careers/',
  'https://www.kampd.com/jobs/',
  'https://www.kampd.com/join-us/',
  'https://www.kampd.com/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  "don't just post it, kamp it",
  'knowledge amplified through professional communities and content.',
  'get kampd',
  'frequently asked questions',
]

const FAQ_SIGNALS = [
  'frequently asked questions',
  'what is the meaning of kampd?',
  'kampd is a contraction of knowledge amplified.',
  'support@kampd.com',
]

const MISSING_ROUTE_SIGNALS = [
  '404: this page could not be found',
  'this page could not be found',
  '"statuscode":404',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
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
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasOfficialFaqSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return FAQ_SIGNALS.every((signal) => normalized.includes(signal))
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
  return MISSING_ROUTE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const createKampdScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Kampd verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Kampd homepage now appears to expose a public jobs surface')
    }

    const faq = await fetchPage(FAQ_URL)
    if (faq.status !== 200 || !hasOfficialFaqSignal(faq.html)) {
      throw new Error('Kampd verified FAQ no longer matches the known first-party support surface')
    }

    if (hasPublicJobsSignal(faq.html)) {
      throw new Error('Kampd FAQ now appears to expose a public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedMissingCareersRoute(careersRoute)) {
        throw new Error('Kampd careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createKampdScraper().run(options)

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
