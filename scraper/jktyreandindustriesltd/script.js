import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jktyreandindustriesltd'
export const COMPANY = 'JK Tyre and Industries Ltd'
export const HOMEPAGE_URL = 'https://www.jktyre.com/'
export const CAREERS_URL = 'https://www.jktyre.com/career'
export const CURRENT_OPENINGS_URL = 'https://www.jktyre.com/career/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /\bjob posting\b/i,
  /\bjob postings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bsearch jobs\b/i,
  /jobposting/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /ashbyhq\.com/i,
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() ?? ''

  return normalized.includes('jk tyre')
    && normalized.includes('industries ltd')
    && normalized.includes('careers')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() ?? ''

  return normalized.includes('careers at jk tyre')
    && normalized.includes('jk tyre & industries ltd')
    && (
      normalized.includes('people marching miles seamlessly')
      || normalized.includes('join a leader in tyre manufacturing')
    )
    && normalized.includes('current openings')
    && (
      normalized.includes('career by choice')
      || normalized.includes('a career with jk tyre')
      || normalized.includes('why jk tyre')
    )
}

export const hasVerifiedEmptyCurrentOpeningsSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() ?? ''

  return normalized.includes('current openings')
    && normalized.includes('no jobs found')
    && normalized.includes('explore more opportunities')
    && normalized.includes('sorry, no matching jobs found')
}

export const hasPublicJobSignal = (html) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createJkTyreAndIndustriesLtdScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('JK Tyre and Industries Ltd verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('JK Tyre and Industries Ltd verified official careers landing no longer matches the known public surface')
    }

    if (hasPublicJobSignal(careersHtml)) {
      throw new Error('JK Tyre and Industries Ltd careers landing now appears to expose public job listings')
    }

    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)

    if (hasVerifiedEmptyCurrentOpeningsSignal(currentOpeningsHtml)) {
      return []
    }

    if (hasPublicJobSignal(currentOpeningsHtml)) {
      throw new Error('JK Tyre and Industries Ltd current openings page now appears to expose public job listings')
    }

    if (!hasVerifiedEmptyCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('JK Tyre and Industries Ltd verified current openings page no longer matches the known empty-state surface')
    }
  },
})

export const run = async (options = {}) => createJkTyreAndIndustriesLtdScraper().run(options)

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
