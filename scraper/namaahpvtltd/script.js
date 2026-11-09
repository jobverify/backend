import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'namaahpvtltd'
export const COMPANY = 'Namaah Pvt Ltd'
export const VERIFIED_ON = '2026-08-03'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Monday, August 3, 2026 that https://namaah.in/ now serves only a first-party JavaScript redirect shell that sends visitors to /lander, with no public jobs board, and that common careers and jobs routes return the same no-public-jobs shell.'
export const HOMEPAGE_URL = 'https://namaah.in/'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://namaah.in/careers',
  'https://namaah.in/careers/',
  'https://namaah.in/jobs',
  'https://namaah.in/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /bamboohr/i,
  /recruitcrm/i,
  /linkedin\.com\/jobs/i,
]

export const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'namaah.in' || hostname === 'www.namaah.in'
  } catch {
    return false
  }
}

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

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<!doctype html>/i.test(page)
    && /<html>\s*<head>\s*<script>\s*window\.onload\s*=\s*function\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*\}\s*<\/script>\s*<\/head>\s*<\/html>/i.test(page)
    && !hasPublicJobsSignal(page)
}

export const isVerifiedNoJobsRoute = (page = {}) =>
  Number(page?.status) === 200
  && hasOfficialHomepageSignal(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const createNamaahScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !isFirstPartyUrl(homepage.url) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Namaah Pvt Ltd homepage no longer matches the verified first-party no-public-jobs surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Namaah Pvt Ltd homepage now appears to expose public jobs')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const page = await fetchPage(routeUrl)
      if (!isFirstPartyUrl(page.url || routeUrl) || !isVerifiedNoJobsRoute(page)) {
        throw new Error(`Namaah Pvt Ltd careers-free route changed or now exposes public jobs: ${page.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNamaahScraper().run(options)

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
