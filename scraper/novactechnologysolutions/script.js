import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'novactechnologysolutions'
export const COMPANY = 'Novac Technology Solutions'
export const CAREERS_URL = 'https://www.novactech.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
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

const OFFICIAL_CAREERS_PATTERN =
  /<title>\s*Careers\s*\|\s*NovacTech\s*<\/title>|Let'?s\s+Grow\s+Together|Novac Technology Solutions/i

const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs|JobPosting/i

const JOB_ROLE_PATH_PATTERN = /^\/(?:careers|jobs?)\/[a-z0-9][a-z0-9-]{2,}\/?$/i
const JOB_CTA_TEXT_PATTERN = /\b(?:apply(?: now)?|view job|job details?|job description|open role)\b/i
const JOB_TITLE_TEXT_PATTERN =
  /\b(?:engineer|developer|analyst|architect|manager|designer|trainer|consultant|specialist|executive|intern|qa|data|software|devops|business|project|product|quality|test|lead|senior|junior|associate)\b/i

export const hasOfficialCareersSignal = (html) => OFFICIAL_CAREERS_PATTERN.test(String(html ?? ''))

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
  PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))
  || extractPublicJobLinks(html).length > 0

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNovacTechnologySolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Novac Technology Solutions official careers page changed; refusing to assume zero public listings')
    }

    if (hasPublicJobBoardSignal(careersHtml)) {
      throw new Error('Novac Technology Solutions careers page now appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createNovacTechnologySolutionsScraper().run(options)

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
