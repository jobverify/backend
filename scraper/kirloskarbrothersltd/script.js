import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kirloskarbrothersltd'
export const COMPANY = 'Kirloskar Brothers Ltd'
export const VERIFIED_ON = '2026-08-07'
export const HOMEPAGE_URL = 'https://www.kirloskarpumps.com/'
export const CAREERS_URL = 'https://www.kirloskarpumps.com/careers/'
export const JOBS_LISTINGS_URL = 'https://www.kirloskarpumps.com/jobs-listings/'
export const APPLICATION_FORM_URL = 'https://www.kirloskarpumps.com/job/apply/candidate/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'kirloskar brothers limited (kbl), founded in 1888',
  'engineering the flow of progress',
  'yamuna, survey no. 98/(3-7), baner, pune 411 045, india.',
]

const CAREERS_SIGNALS = [
  "shape the future with a company that's shaped the world.",
  'why work at kbl?',
  'submit your resume. build what matters.',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/[â€˜â€™]/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeText(html)
  return CAREERS_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasResumeOnlySignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return normalized.includes('submit your resume')
    && normalized.includes('upload resume')
    && /<form[^>]+action=["']\/careers\/#wpcf7/i.test(page)
    && /<input[^>]+(?:id=["']resume-file["'][^>]+type=["']file["']|type=["']file["'][^>]+id=["']resume-file["'])/i.test(page)
    && /contact-form-7|wpcf7/i.test(page)
}

export const hasUnavailableSurfaceSignal = (page = {}) =>
  Number(page?.status) === 503

export const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    let absoluteUrl

    try {
      absoluteUrl = new URL(match[1], CAREERS_URL).toString()
    } catch {
      continue
    }

    if (seen.has(absoluteUrl)) continue

    const url = new URL(absoluteUrl)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const isVerifiedCareersPage =
      absoluteUrl === CAREERS_URL || `${absoluteUrl}/` === CAREERS_URL
    const isSuspiciousFirstPartyJobRoute =
      ['www.kirloskarpumps.com', 'kirloskarpumps.com'].includes(url.hostname)
      && /\/(jobs?|job-openings?|openings?|vacanc(?:y|ies)|apply)(\/|$)/i.test(pathname)
      && !isVerifiedCareersPage

    if (PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(absoluteUrl)) || isSuspiciousFirstPartyJobRoute) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

export const createKirloskarBrothersLtdScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (hasUnavailableSurfaceSignal(homepage)) {
      const [careersPage, jobsListingsPage, applicationFormPage] = await Promise.all([
        fetchPage(CAREERS_URL),
        fetchPage(JOBS_LISTINGS_URL),
        fetchPage(APPLICATION_FORM_URL),
      ])

      if (
        hasUnavailableSurfaceSignal(careersPage)
        && hasUnavailableSurfaceSignal(jobsListingsPage)
        && hasUnavailableSurfaceSignal(applicationFormPage)
      ) {
        return []
      }
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Kirloskar Brothers Ltd verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Kirloskar Brothers Ltd homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Kirloskar Brothers Ltd verified official careers surface no longer matches the known public surface')
    }

    if (!hasResumeOnlySignal(careersPage.html)) {
      throw new Error('Kirloskar Brothers Ltd verified resume-only careers surface changed')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Kirloskar Brothers Ltd careers page now appears to expose a public jobs surface')
    }

    const suspiciousLinks = extractSuspiciousPublicJobLinks(careersPage.html)
    if (suspiciousLinks.length > 0) {
      throw new Error('Kirloskar Brothers Ltd careers page now exposes public job links')
    }

    return []
  },
})

export const run = async (options = {}) => createKirloskarBrothersLtdScraper().run(options)

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
