import {runCurrentHano} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'



const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hanosoftwaresolutions'
export const COMPANY = 'Hano Software Solutions'
export const HOMEPAGE_URL = 'https://www.hanosoftwaresolutions.com/'
export const CAREERS_ROUTE_URLS = [
  'https://www.hanosoftwaresolutions.com/careers',
  'https://www.hanosoftwaresolutions.com/careers/',
  'https://www.hanosoftwaresolutions.com/career',
  'https://www.hanosoftwaresolutions.com/career/',
  'https://www.hanosoftwaresolutions.com/jobs',
  'https://www.hanosoftwaresolutions.com/jobs/',
  'https://www.hanosoftwaresolutions.com/join-us',
  'https://www.hanosoftwaresolutions.com/join-us/',
]

const HOMEPAGE_SIGNALS = [
  '<title>hano software solution private limited</title>',
  '<div id="root"></div>',
  'fonts.googleapis.com/css2?family=lato',
  'fonts.googleapis.com/css2?family=lateef',
  'swiper-element-bundle.min.js',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
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
  /freshteam/i,
  /zohorecruit/i,
  /\/jobs?\/[a-z0-9-]+/i,
]

const BUNDLE_REQUIRED_SIGNALS = [
  '/products/:slug',
  '/projects',
  'TapIN Pay',
  'TVK Papanasam',
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /["'`]\/careers(?:\/|["'`])/i,
  /["'`]\/career(?:\/|["'`])/i,
  /["'`]\/jobs(?:\/|["'`])/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
]

const normalizeHtml = (value) => String(value ?? '').toLowerCase()

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeHtml(html)
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const hasVerifiedBundleSignal = (bundleText) => {
  const rawText = String(bundleText ?? '')
  return BUNDLE_REQUIRED_SIGNALS.every((signal) => rawText.includes(signal))
}

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedCareersShell = (page = {}) =>
  Number(page?.status) === 200
  && hasOfficialHomepageSignal(page?.html)
  && extractBundleAssetPath(page?.html) !== null
  && !hasPublicJobsSignal(page?.html)

export const createHanoSoftwareSolutionsScraper = () => ({run:runCurrentHano})

export const run = async (options = {}) => createHanoSoftwareSolutionsScraper(options).run(options)

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
