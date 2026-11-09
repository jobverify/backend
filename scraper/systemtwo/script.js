import path from 'path'
import { fileURLToPath } from 'url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://system-two.ai/'
export const ABOUT_PAGE_URL = 'https://system-two.ai/about'
export const CAREERS_ROUTE_URL = 'https://system-two.ai/careers'
export const JOBS_ROUTE_URL = 'https://system-two.ai/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*System Two\s*<\/title>/i
const HOMEPAGE_TAGLINE_PATTERN =
  />\s*Building agent-native products and documenting the process\.\s*</i
const ABOUT_HEADING_PATTERN = /<h1[^>]*>\s*About\s*<\/h1>/i
const ABOUT_WESLEY_PATTERN = /I(?:&#x27;|')m Wesley\./i
const ABOUT_AGENT_PATTERN = /build things with AI agents and document the process in public/i
const NAV_PROJECTS_PATTERN = /href=["'][^"']*\/projects["']/i
const NAV_BLOG_PATTERN = /href=["'][^"']*\/blog["']/i
const NAV_ABOUT_PATTERN = /href=["'][^"']*\/about["']/i
const CAREERS_LINK_PATTERN =
  /href=["'][^"']*(?:\/careers(?:\/)?|\/jobs(?:\/)?|greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com)[^"']*["']/i
const PUBLIC_JOBS_SIGNAL_PATTERN =
  /\b(careers?|jobs?|hiring|open roles?|open positions?|job openings?|join us|join our team)\b/i
const NOT_FOUND_TITLE_PATTERN = /<title>\s*404:\s*This page could not be found\.\s*<\/title>/i
const NOT_FOUND_BODY_PATTERN = />\s*This page could not be found\.\s*</i

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

const defaultFetchText = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  if (response.status >= 500 || response.status === 429) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}, {
  label: 'systemtwo',
  attempts: 3,
  baseDelayMs: 2000,
})

const stripHtml = (html) =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const hasVerifiedNavShell = (html) => {
  const page = String(html ?? '')
  return NAV_PROJECTS_PATTERN.test(page)
    && NAV_BLOG_PATTERN.test(page)
    && NAV_ABOUT_PATTERN.test(page)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return HOMEPAGE_TITLE_PATTERN.test(page)
    && HOMEPAGE_TAGLINE_PATTERN.test(page)
    && hasVerifiedNavShell(page)
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  return HOMEPAGE_TITLE_PATTERN.test(page)
    && ABOUT_HEADING_PATTERN.test(page)
    && ABOUT_WESLEY_PATTERN.test(page)
    && ABOUT_AGENT_PATTERN.test(page)
    && hasVerifiedNavShell(page)
}

export const hasCareersNavigationLink = (html) =>
  CAREERS_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERN.test(stripHtml(html))

export const isVerifiedMissingCareerRoute = (html) => {
  const page = String(html ?? '')
  return NOT_FOUND_TITLE_PATTERN.test(page)
    && NOT_FOUND_BODY_PATTERN.test(page)
    && hasVerifiedNavShell(page)
    && !hasCareersNavigationLink(page)
    && !hasPublicJobsSignal(page)
}

const validateEmptyJobs = (jobs) => {
  if (!Array.isArray(jobs) || jobs.length !== 0) {
    throw new Error('System Two sentinel expected no public jobs from the verified first-party surface')
  }

  return jobs
}

export const createSystemTwoScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)
      || hasCareersNavigationLink(homepageHtml)
      || hasPublicJobsSignal(homepageHtml)) {
      throw new Error('System Two homepage no longer matches the verified no-public-jobs surface')
    }

    const aboutHtml = await fetchText(ABOUT_PAGE_URL)

    if (!hasOfficialAboutSignal(aboutHtml)
      || hasCareersNavigationLink(aboutHtml)
      || hasPublicJobsSignal(aboutHtml)) {
      throw new Error('System Two about page no longer matches the verified no-public-jobs surface')
    }

    const careersHtml = await fetchText(CAREERS_ROUTE_URL)
    if (!isVerifiedMissingCareerRoute(careersHtml)) {
      throw new Error('System Two checked careers route no longer matches the verified 404 surface')
    }

    const jobsHtml = await fetchText(JOBS_ROUTE_URL)
    if (!isVerifiedMissingCareerRoute(jobsHtml)) {
      throw new Error('System Two checked jobs route no longer matches the verified 404 surface')
    }

    return validateEmptyJobs([])
  },
})

export const run = async () => createSystemTwoScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'systemtwo')
  }
}
