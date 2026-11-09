import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'turboenergy'
export const COMPANY = 'Turbo Energy'
export const HOMEPAGE_URL = 'https://www.turboenergy.co.in/'
export const CAREERS_URL = 'https://www.turboenergy.co.in/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
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

const PUBLIC_JOB_BOARD_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /\/careers\/[a-z0-9-]+/i,
  /\/jobs?\/[a-z0-9-]+/i,
  /\bcurrent openings?\b/i,
  /\bjob openings?\b/i,
  /\bopen positions?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
]

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

  return normalized.includes('turbo energy private limited (tel), a leading name in the manufacturing of turbochargers, has become synonymous with quality, affordability and dependability.')
    && normalized.includes('copyright')
    && normalized.includes('turbo energy private limited')
}

export const hasOfficialCareersShellSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers - turbo energy private limited')
    && normalized.includes('company')
    && normalized.includes('about tel')
    && normalized.includes('manufacturing and quality')
    && normalized.includes('sustainability and csr')
    && (normalized.includes('product & technology') || normalized.includes('product and technology'))
    && normalized.includes('partner zone')
    && normalized.includes('contact us')
    && normalized.includes('copyright')
    && normalized.includes('turbo energy private limited')
}

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOB_BOARD_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTurboEnergyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Turbo Energy homepage no longer matches the verified careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (hasPublicJobBoardSignal(careersHtml)) {
      throw new Error('Turbo Energy careers page now appears to expose public job listings')
    }

    if (!hasOfficialCareersShellSignal(careersHtml)) {
      throw new Error('Turbo Energy careers page no longer matches the verified empty careers shell')
    }

    return []
  },
})

export const run = async (options = {}) => createTurboEnergyScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
