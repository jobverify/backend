import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'smartcliff'
export const COMPANY = 'SmartCliff Learning Solutions LLP'
export const CAREERS_URL = 'https://smartcliff.in/career'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
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

const OFFICIAL_CAREERS_SIGNALS = [
  'career | smartcliff',
  'career',
  'discover in-demand careers today!',
  'smartcliff',
  'all rights reserved',
]

const PUBLIC_JOB_BOARD_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /workdayjobs/i,
]

const JOB_ROLE_PATH_PATTERN = /^\/(?:career|jobs?)\/[a-z0-9][a-z0-9-]{2,}\/?$/i
const JOB_CTA_TEXT_PATTERN = /\b(?:apply(?: now)?|view job|job details?|job description|open role)\b/i
const JOB_TITLE_TEXT_PATTERN =
  /\b(?:engineer|developer|analyst|architect|manager|designer|trainer|consultant|specialist|executive|intern|qa|data|software|devops|business|project|product|quality|test|lead|senior|junior|associate)\b/i

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return OFFICIAL_CAREERS_SIGNALS.every((signal) => normalized.includes(signal))
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

export const createSmartCliffScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('SmartCliff official careers page changed; refusing to assume zero public listings')
    }

    if (hasPublicJobBoardSignal(careersHtml)) {
      throw new Error('SmartCliff careers page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createSmartCliffScraper().run(options)

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
