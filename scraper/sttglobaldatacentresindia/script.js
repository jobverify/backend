import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sttglobaldatacentresindia'
export const COMPANY = 'STT Global Data Centres India Private Limited'
export const HOMEPAGE_URL = 'https://www.sttgdc.com/in-en'
export const ABOUT_URL = 'https://www.sttgdc.com/in-en/about-us/the-company'
export const CAREERS_URL = 'https://www.sttgdc.com/in-en/about-us/careers'
export const CONTACT_URL = 'https://www.sttgdc.com/contact'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERNS = [
  /\bstt\s*gdc\b/i,
  /\bstt gdc india\b/i,
  /\bbuilt for ai\b/i,
  /\bservices\b/i,
  /\blocations\b/i,
  /\bcareers\b/i,
]

const ABOUT_SIGNAL_PATTERNS = [
  /\babout the company\b/i,
  /\bwhy stt gdc india\b/i,
  /\bour leadership\b/i,
  /\bdiversity and inclusion\b/i,
  /\baccreditation\b/i,
]

const CAREERS_SIGNAL_PATTERNS = [
  /\bcareers\b/i,
  /\bgrow your career with us\b/i,
  /\bshaping a better digital world\b/i,
  /\bjob enquiries and applications\b/i,
  /\bwrite to us below\b/i,
]

const CONTACT_SIGNAL_PATTERNS = [
  /\bcontact\b/i,
  /\blet us know how we can help you\b/i,
  /\bhow can we help you\??\b/i,
  /\bstt\s*gdc\b|stt? telemedia global data centres/i,
]

const PUBLIC_JOB_LISTING_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview details\b/i,
  /\bapply now\b/i,
  /href=["'][^"']*\/jobs?\/[^"']+["']/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const EMAIL_PATTERN = /\b([a-z0-9._%+-]+@sttelemediagdc\.in)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasAllPatterns = (html, patterns) => {
  const normalized = normalizeText(html)
  return patterns.every((pattern) => pattern.test(normalized))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => hasAllPatterns(html, HOMEPAGE_SIGNAL_PATTERNS)

export const hasOfficialAboutSignal = (html) => hasAllPatterns(html, ABOUT_SIGNAL_PATTERNS)

export const hasOfficialCareersSignal = (html) => hasAllPatterns(html, CAREERS_SIGNAL_PATTERNS)

export const hasOfficialContactSignal = (html) => hasAllPatterns(html, CONTACT_SIGNAL_PATTERNS)

export const extractEmailApplyHandoff = (html) => {
  const match = decodeHtmlEntities(String(html ?? '')).match(EMAIL_PATTERN)
  return match?.[1]?.toLowerCase() || null
}

export const hasPublicJobListingSignal = (html) =>
  PUBLIC_JOB_LISTING_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createSttGlobalDataCentresIndiaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('STT verified India homepage no longer matches the trusted first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('STT verified about page no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('STT verified careers page no longer matches the trusted first-party surface')
    }

    if (!extractEmailApplyHandoff(careersHtml)) {
      throw new Error('STT careers page no longer exposes the verified email-only application handoff')
    }

    if (hasPublicJobListingSignal(careersHtml)) {
      throw new Error('STT careers page now appears to expose public job records')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('STT verified contact page no longer matches the trusted first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSttGlobalDataCentresIndiaScraper().run(options)

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
