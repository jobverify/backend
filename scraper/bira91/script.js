import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bira91'
export const COMPANY = 'Bira 91'
export const HOMEPAGE_URL = 'https://bira91.com/'
export const CAREERS_ROUTE_URLS = [
  'https://bira91.com/careers',
  'https://bira91.com/careers/',
  'https://bira91.com/jobs',
  'https://bira91.com/jobs/',
  'https://bira91.com/join-us',
  'https://bira91.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const VERIFIED_404_SIGNALS = [
  '404 not found',
  'the requested url was not found on this server.',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
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
    html: await response.text(),
  }
}

export const hasVerifiedFirstParty404Signal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return VERIFIED_404_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerified404Page = (page = {}) =>
  Number(page?.status) === 404
  && !hasPublicJobsSignal(page?.html)
  && hasVerifiedFirstParty404Signal(page?.html)

export const isBlockedNetworkError = (error) => /connect timeout|und_err_connect_timeout|err_cert_common_name_invalid|hostname\/ip does not match certificate's altnames/i.test(
  `${error?.message ?? ''} ${error?.cause?.message ?? ''} ${error?.cause?.code ?? ''}`,
)

export const createBira91Scraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    let homepage

    try {
      homepage = await fetchPage(HOMEPAGE_URL)
    } catch (error) {
      if (isBlockedNetworkError(error)) {
        return []
      }

      throw error
    }

    if (!isVerified404Page(homepage)) {
      throw new Error('Bira 91 verified official homepage surface changed; refusing to guess any public jobs source')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      let careersRoute

      try {
        careersRoute = await fetchPage(careersRouteUrl)
      } catch (error) {
        if (isBlockedNetworkError(error)) {
          return []
        }

        throw error
      }

      if (!isVerified404Page(careersRoute)) {
        throw new Error('Bira 91 careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createBira91Scraper().run(options)

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
