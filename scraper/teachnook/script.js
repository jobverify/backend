import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'teachnook'
export const COMPANY = 'Teachnook'
export const HOMEPAGE_URL = 'https://teachnook.in/'
export const CAREERS_URL = 'https://teachnook.in/careers'
export const LANDER_URL = 'https://teachnook.in/lander'
export const ALT_HOMEPAGE_URL = 'https://teachnook.com/'
export const ALT_CAREERS_URL = 'https://teachnook.com/careers'
export const APPLY_URL = null
export const PRIMARY_URLS = [
  HOMEPAGE_URL,
  CAREERS_URL,
  LANDER_URL,
  ALT_HOMEPAGE_URL,
  ALT_CAREERS_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bcareers at teachnook\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /greenhouse/i,
  /lever/i,
  /smartrecruiters/i,
  /ashbyhq/i,
  /jobvite/i,
]

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
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
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

export const hasOfficialRedirectSignal = (html) => {
  const page = String(html ?? '')
  return /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*\}/i.test(page)
}

export const hasParkedLanderSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(page)
    && normalized.includes('parking')
    && /img1\.wsimg\.com/i.test(page)
    && /parking-lander/i.test(page)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasConnectTimeoutFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return code === 'UND_ERR_CONNECT_TIMEOUT'
    || /\bconnect timeout\b/i.test(message)
    || /\btimeout\b/i.test(message)
}

export const createTeachnookScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      if (homepage.status !== 200 || !hasOfficialRedirectSignal(homepage.html)) {
        if (hasPublicJobsSignal(homepage.html)) {
          throw new Error('Teachnook homepage now appears to expose public jobs')
        }

        throw new Error('Teachnook homepage no longer matches the verified official redirect surface')
      }

      const careersPage = await fetchPage(CAREERS_URL)
      if (hasPublicJobsSignal(careersPage.html)) {
        throw new Error('Teachnook official careers route now appears to expose public jobs')
      }

      if (careersPage.status !== 200 || !hasOfficialRedirectSignal(careersPage.html)) {
        throw new Error('Teachnook careers route no longer matches the verified official redirect surface')
      }

      // The current first-party flow terminates on a parked lander instead of a public hiring surface.
      const landerPage = await fetchPage(LANDER_URL)
      if (landerPage.status !== 200 || !hasParkedLanderSignal(landerPage.html)) {
        throw new Error('Teachnook redirect target no longer matches the verified parked lander')
      }

      if (hasPublicJobsSignal(landerPage.html)) {
        throw new Error('Teachnook redirect target now appears to expose public jobs')
      }

      return []
    } catch (error) {
      if (hasConnectTimeoutFailure(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createTeachnookScraper().run(options)

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
