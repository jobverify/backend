import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ionexchangezerob'
export const COMPANY = 'ION EXCHANGE ZERO B'
export const HOMEPAGE_URL = 'https://www.zerobonline.com/'
export const STORY_URL = 'https://www.zerobonline.com/our-story/'
export const CAREERS_URL = 'https://ionexchangeglobal.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_LISTING_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview details\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const EMAIL_PATTERN = /\b([a-z0-9._%+-]+@ionexchange\.co\.in)\b/i
const CAREERS_HANDOFF_PATTERN = /href=["'](https?:\/\/careers\.ionindia\.com\/?[^"']*)["']/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '–')
  .replace(/&#8212;|&mdash;/gi, '—')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    if (!url.pathname || url.pathname === '') url.pathname = '/'
    return url.toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(html)

  return /<title>\s*Get Pure Water Filters Online \| Best RO UV Purifiers - ZeroB\s*<\/title>/i.test(page)
    && normalized.includes('#BharatKaPaani')
    && normalized.includes('Ion Exchange (India) Ltd.')
    && normalized.includes('zerob@ionexchange.co.in')
    && /href=["'][^"']*\/careers\/["']/i.test(page)
}

export const hasOfficialStorySignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('Our Story')
    && normalized.includes('there was Ion Exchange, a legend since 1964')
    && normalized.includes('Fast forward to 1986, and boom– ZeroB was born')
    && normalized.includes('Ion Exchange (India) Ltd.')
    && normalized.includes('ZeroB a flagship brand of Ion Exchange')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(html)

  return /<title>\s*Careers\s*-\s*Ion Exchange\s*<\/title>/i.test(page)
    && normalized.includes('Join Us!')
    && normalized.includes('Drop Your Resume Here')
    && normalized.includes('recruit@ionexchange.co.in')
    && normalized.includes('Explore jobs')
    && /href=["']https?:\/\/careers\.ionindia\.com\/jobs/i.test(page)
}

export const extractOutboundCareersUrl = (html) => {
  const match = String(html ?? '').match(CAREERS_HANDOFF_PATTERN)
  return normalizeUrl(match?.[1] ?? null)
}

export const extractEmailApplyHandoff = (html) => {
  const match = decodeHtmlEntities(String(html ?? '')).match(EMAIL_PATTERN)
  return match?.[1]?.toLowerCase() || null
}

export const hasPublicJobListingSignal = (html) =>
  PUBLIC_JOB_LISTING_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createIonExchangeZeroBScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('ION EXCHANGE ZERO B verified ZeroB homepage no longer matches the trusted first-party surface')
    }

    const storyHtml = await fetchText(STORY_URL)
    if (!hasOfficialStorySignal(storyHtml)) {
      throw new Error('ION EXCHANGE ZERO B verified ZeroB story page no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('ION EXCHANGE ZERO B verified Ion Exchange careers page no longer matches the trusted first-party surface')
    }

    if (!extractOutboundCareersUrl(careersHtml)) {
      throw new Error('ION EXCHANGE ZERO B careers page no longer exposes the verified outbound careers handoff')
    }

    if (!extractEmailApplyHandoff(careersHtml)) {
      throw new Error('ION EXCHANGE ZERO B careers page no longer exposes the verified resume email handoff')
    }

    if (hasPublicJobListingSignal(careersHtml)) {
      throw new Error('ION EXCHANGE ZERO B careers page now appears to expose public job records')
    }

    return []
  },
})

export const run = async (options = {}) => createIonExchangeZeroBScraper().run(options)

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
