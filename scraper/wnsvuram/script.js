import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wnsvuram'
export const COMPANY = 'WNS-Vuram'
export const HOMEPAGE_URL = 'https://www.vuram.com/'
export const CAREERS_URL = 'https://www.vuram.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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
  /recruitcrm/i,
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

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('wns-vuram')
    && normalized.includes('from complexity to clarity')
    && normalized.includes('hyperautomation')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('wns-vuram careers')
    && normalized.includes('roi calculator')
    && normalized.includes('return-on-investment')
    && normalized.includes('get in touch')
    && normalized.includes('contact me')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page.html).toLowerCase()

  return Number(page.status) === 404
    && /(^|\.)vuram\.com$/i.test(new URL(page.url || CAREERS_URL).hostname)
    && normalized.includes('404 error page')
    && !hasPublicJobsSignal(page.html)
}

export const createWnsVuramScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('WNS-Vuram official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    const hasVerifiedCareersShell =
      careersPage.status === 200 && hasOfficialCareersSignal(careersPage.html)
    const hasVerifiedMissingRoute = isVerifiedMissingCareersRoute(careersPage)

    if (!hasVerifiedCareersShell && !hasVerifiedMissingRoute) {
      throw new Error('WNS-Vuram careers page changed materially or no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('WNS-Vuram careers page now appears to expose a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createWnsVuramScraper().run(options)

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
