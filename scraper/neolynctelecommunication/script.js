import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'neolynctelecommunication'
export const COMPANY = 'NeoLync'
export const HOMEPAGE_URL = 'https://neolync.com/'
export const PUBLIC_JOB_ROUTE_URLS = [
  'https://neolync.com/careers',
  'https://neolync.com/careers/',
  'https://neolync.com/career',
  'https://neolync.com/career/',
  'https://neolync.com/jobs',
  'https://neolync.com/jobs/',
  'https://neolync.com/join-us',
  'https://neolync.com/join-us/',
  'https://neolync.com/work-with-us',
  'https://neolync.com/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
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
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const HOMEPAGE_TEXT_SIGNALS = [
  'electronic product creation reimagined',
  'state-of-the-art 90k+ sq ft manufacturing facility',
  'contact@neolync.com',
]

const INLINE_CAREERS_TEXT_SIGNALS = [
  'we are always looking for talented people to join our team.',
  'send us your resume at',
  'careers@neolync.com',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
]

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return /<title>\s*neolync\s*<\/title>/i.test(String(html))
    && HOMEPAGE_TEXT_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasInlineCareersBlockSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return INLINE_CAREERS_TEXT_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createNeolyncTeleCommunicationScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('NeoLync verified official homepage no longer matches the known public surface')
    }

    if (!hasInlineCareersBlockSignal(homepage.html)) {
      throw new Error('NeoLync verified inline careers block no longer matches the trusted zero-job surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('NeoLync homepage now appears to expose public openings')
    }

    for (const routeUrl of PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (routePage.status !== 404) {
        throw new Error(`NeoLync public jobs route ${routeUrl} no longer matches the verified 404 zero-job state`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNeolyncTeleCommunicationScraper().run(options)

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
