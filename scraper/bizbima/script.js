import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bizbima'
export const COMPANY = 'BizBima'
export const VERIFIED_AT = '2026-07-13'
export const HOMEPAGE_URL = 'https://bizbima.com/'
export const WWW_HOMEPAGE_URL = 'https://www.bizbima.com/'
export const ROBOTS_URL = 'https://bizbima.com/robots.txt'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bview openings\b/i,
  /\bopen roles\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasParkedHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*BizBima\.com for sale \| Spaceship\.com\s*<\/title>/i.test(page)
    && normalized.includes('domain for sale')
    && normalized.includes('spaceship.com')
    && normalized.includes('bizbima.com')
}

export const hasOpenRobotsSignal = (text) => {
  const normalized = String(text ?? '')
    .replace(/\r/g, '')
    .trim()

  return normalized === 'User-agent: *\nAllow: /'
}

export const createBizBimaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasParkedHomepageSignal(homepageHtml)) {
      throw new Error('BizBima homepage no longer matches the verified parked-domain surface')
    }
    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('BizBima homepage now appears to expose public jobs')
    }

    const wwwHomepageHtml = await fetchText(WWW_HOMEPAGE_URL)
    if (!hasParkedHomepageSignal(wwwHomepageHtml)) {
      throw new Error('BizBima www homepage no longer matches the verified parked-domain surface')
    }
    if (hasPublicJobsSignal(wwwHomepageHtml)) {
      throw new Error('BizBima www homepage now appears to expose public jobs')
    }

    const robotsTxt = await fetchText(ROBOTS_URL)
    if (!hasOpenRobotsSignal(robotsTxt)) {
      throw new Error('BizBima robots.txt no longer matches the verified parked-domain surface')
    }

    return []
  },
})

export const run = async (options = {}) => createBizBimaScraper().run(options)

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
