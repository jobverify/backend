import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sanengineeringlocomotivecoltd'
export const COMPANY = 'SAN Engineering & Locomotive Co. Ltd'
export const HOMEPAGE_URL = 'https://san-engineering.com/'
export const CAREERS_URL = 'https://san-engineering.com/careers-2/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|\u2013/gi, '-')
  .replace(/&mdash;|&#8212;|\u2014/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const CAREERS_LINK_PATTERN =
  /href=["']https?:\/\/(?:www\.)?san-engineering\.com\/careers-2\/?["'][^>]*>\s*CAREERS\s*</i

const HOMEPAGE_TITLE_PATTERN = /<title>\s*SAN Engineering and Locomotive Co\. Ltd\.\s*<\/title>/i
const CAREERS_TITLE_PATTERN = /<title>\s*CAREERS\s*:\s*SAN Engineering and Locomotive Co\. Ltd\.\s*<\/title>/i

const PUBLIC_JOB_LISTING_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bopen positions\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjob description\b/i,
  /href=["']https?:\/\/(?:www\.)?san-engineering\.com\/jobs?\/[^"']+["']/i,
  /href=["']\/jobs?\/[^"']+["']/i,
  /class=["'][^"']*(?:job|career)[^"']*(?:card|item|list|opening|vacancy)[^"']*["']/i,
]

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalizedText = normalizeWhitespace(page) || ''
  const hasSanDescriptionMeta =
    /<meta[^>]+name=["']description["'][^>]*>/i.test(page)
    && /<meta[^>]+content=["']San Engineering["'][^>]*>/i.test(page)

  return HOMEPAGE_TITLE_PATTERN.test(page)
    && hasSanDescriptionMeta
    && CAREERS_LINK_PATTERN.test(page)
    && normalizedText.includes('Products Engineered and Built To Last')
    && normalizedText.includes('San Engineering is a leading manufacturer of locomotives')
  }

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalizedText = normalizeWhitespace(page) || ''

  return CAREERS_TITLE_PATTERN.test(page)
    && CAREERS_LINK_PATTERN.test(page)
    && /<section[^>]+id=["']page-3925["']/i.test(page)
    && normalizedText.includes('You are here: Home \\ CAREERS')
    && normalizedText.includes('APPLY FOR JOB')
    && /href=["']mailto:careers@san-engineering\.com["']/i.test(page)
    && normalizedText.includes('You may email your resume to careers@san-engineering.com')
}

export const hasPublicJobListingSignal = (html) => {
  const page = String(html ?? '')
  const normalizedText = normalizeWhitespace(page) || ''

  return PUBLIC_JOB_LISTING_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalizedText))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSanEngineeringLocomotiveCoLtdScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('SAN Engineering homepage no longer matches the verified official surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('SAN Engineering careers page no longer matches the verified official email-only surface')
    }

    if (hasPublicJobListingSignal(careersHtml)) {
      throw new Error('SAN Engineering verified careers page now exposes public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createSanEngineeringLocomotiveCoLtdScraper().run(options)

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
