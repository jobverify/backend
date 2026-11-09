import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'strandlifesciences'
export const COMPANY = 'Strand Life Sciences'
export const HOMEPAGE_URL = 'https://us.strandls.com/'
export const CAREERS_URL = 'https://us.strandls.com/careers'
export const PRIVACY_URL = 'https://us.strandls.com/privacy'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERNS = [
  /\bstrand life sciences\b/i,
  /\bbangalore\b/i,
  /\bcap lab\b/i,
  /\bprecision medicine\b/i,
]

const CAREERS_SIGNAL_PATTERNS = [
  /\bcareers - strand life sciences\b/i,
  /\bjoin us\b/i,
  /\bopen roles\b/i,
  /\bresume\b/i,
  /\b(?:g-)?recaptcha\b/i,
]

const PRIVACY_SIGNAL_PATTERNS = [
  /\bprivacy\b/i,
  /\bdata controller\b/i,
  /\bbangalore\b/i,
]

const UNEXPECTED_PUBLIC_JOBS_PATTERNS = [
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /career-opportunities\/[^"'`\s<>]+/i,
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'strandlifesciences',
  timeoutMs: 15000,
})

export const hasHomepageSignal = (html) =>
  HOMEPAGE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasCareersPageSignal = (html) =>
  CAREERS_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasPrivacyPageSignal = (html) =>
  PRIVACY_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasUnexpectedPublicJobsSignal = (html) =>
  UNEXPECTED_PUBLIC_JOBS_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createStrandLifeSciencesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasHomepageSignal(homepageHtml)) {
      throw new Error('Strand Life Sciences homepage no longer exposes the verified brand and Bangalore signals')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasCareersPageSignal(careersHtml)) {
      throw new Error('Strand Life Sciences careers page no longer exposes the verified application-form surface')
    }

    if (hasUnexpectedPublicJobsSignal(careersHtml)) {
      throw new Error('Strand Life Sciences careers page now exposes public jobs')
    }

    const privacyHtml = await fetchText(PRIVACY_URL)

    if (!hasPrivacyPageSignal(privacyHtml)) {
      throw new Error('Strand Life Sciences privacy page no longer exposes the verified Bangalore contact surface')
    }

    return []
  },
})

export const run = async (options = {}) => createStrandLifeSciencesScraper().run(options)

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
