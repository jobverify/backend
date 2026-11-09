import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'innocito'
export const COMPANY = 'Innocito'
export const CAREERS_URL = 'https://innocito.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
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
  'careers - join our team of digital engineers | innocito',
  'innocito technologies llc',
  '511 e john carpenter fwy',
  'innocito private limited',
  'tech mahindra campus, vizag city center',
  'the business park by pranava group',
  'all rights reserved',
]

const PUBLIC_JOB_BOARD_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /jobvite/i,
  /"@type"\s*:\s*"JobPosting"/i,
]

const JOB_ROLE_PATH_PATTERN = /^\/(?:careers?|jobs?)\/[a-z0-9][a-z0-9-]{2,}\/?$/i
const JOB_CTA_TEXT_PATTERN = /\b(?:apply(?: now)?|view jobs?|job details?|job description|open role)\b/i
const JOB_TITLE_TEXT_PATTERN =
  /\b(?:engineer|developer|analyst|architect|manager|designer|trainer|consultant|specialist|executive|intern|qa|data|software|devops|business|project|product|quality|test|lead|senior|junior|associate)\b/i

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return OFFICIAL_CAREERS_SIGNALS.every((signal) => normalized.includes(signal))
    && /<title[^>]*>\s*Careers - Join Our Team of Digital Engineers \| Innocito\s*<\/title>/i.test(rawHtml)
    && /href=["']https:\/\/innocito\.com\/careers["']/i.test(rawHtml)
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

export const createInnocitoScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Innocito official careers page changed; refusing to assume zero public listings')
    }

    if (hasPublicJobBoardSignal(careersHtml)) {
      throw new Error('Innocito careers page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createInnocitoScraper().run(options)

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
