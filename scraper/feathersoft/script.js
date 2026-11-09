import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'feathersoft'
export const COMPANY = 'Feathersoft'
export const HOMEPAGE_URL = 'https://www.feathersoft.com/'
export const CAREERS_URL = 'https://www.feathersoft.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8217;|&rsquo;/gi, "'")
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const HOMEPAGE_SIGNALS = [
  'feathersoft is now',
  'data engineering analytics',
  'digital transformation',
  'cloud services',
  'managed it services',
]

const CAREERS_SIGNALS = [
  'find authentic jobs at feathersoft career apply online',
  'we appreciate your interest in exploring career opportunities with us',
  'currently we have the following openings',
  'jobs and career at feathersoft',
  'let s connect',
  'thank you for your time and interest',
]

const PUBLIC_JOB_BOARD_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
]

const JOB_ROLE_PATH_PATTERN = /^\/(?:careers|jobs?)\/[a-z0-9][a-z0-9-]{2,}(?:\/(?:apply)?)?\/?$/i
const JOB_CTA_TEXT_PATTERN = /\b(?:apply(?: now)?|view job|job details?|job description|open role)\b/i
const JOB_TITLE_TEXT_PATTERN =
  /\b(?:engineer|developer|analyst|architect|manager|designer|trainer|consultant|specialist|executive|intern|qa|data|software|devops|business|project|product|quality|test|lead|senior|junior|associate)\b/i

export const extractCareersUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (absoluteUrl === CAREERS_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
    && extractCareersUrl(html) === CAREERS_URL
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return CAREERS_SIGNALS.every((signal) => normalized.includes(signal))
    || hasOfficialHomepageSignal(html)
}

export const extractPublicJobLinks = (html, baseUrl = CAREERS_URL) => {
  const links = []

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], baseUrl)
    if (!absoluteUrl) continue

    const pathname = new URL(absoluteUrl).pathname
    const text = normalizeWhitespace(match[2])
    if (
      JOB_ROLE_PATH_PATTERN.test(pathname)
      && (JOB_CTA_TEXT_PATTERN.test(text) || JOB_TITLE_TEXT_PATTERN.test(text))
    ) {
      links.push(absoluteUrl)
    }
  }

  return [...new Set(links)]
}

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOB_BOARD_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))
  || extractPublicJobLinks(html).length > 0

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFeathersoftScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Feathersoft homepage no longer matches the verified careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (hasPublicJobBoardSignal(careersHtml)) {
      throw new Error('Feathersoft careers page now appears to expose public job listings')
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Feathersoft careers page no longer matches the verified empty careers shell')
    }

    return []
  },
})

export const run = async (options = {}) => createFeathersoftScraper().run(options)

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
