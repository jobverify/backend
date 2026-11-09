import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'testpress'
export const COMPANY = 'Testpress Tech Labs'
export const HOMEPAGE_URL = 'https://testpress.tech/'
export const ABOUT_URL = 'https://testpress.tech/about-us/'
export const CAREERS_URL = 'https://testpress.tech/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const PUBLIC_JOB_LISTING_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview details\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const OUTBOUND_APPLY_PATTERN = /href=["'](https:\/\/zfrmz\.com\/[^"']+)["']/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('Discover Why Leading Institutes Trust Testpress')
    && normalized.includes('support@testpress.in')
    && normalized.includes('Join us as Software Developer')
    && normalized.includes('Testpress Tech Labs')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('Journey of Testpress')
    && normalized.includes('Birth of Testpress Online Exam Software (2014)')
    && normalized.includes('Testpress was born in 2014')
    && normalized.includes('HR/Career')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('Apply for Software Developer')
    && normalized.includes('if so, we want to meet you.')
    && normalized.includes('Who should join us?')
    && normalized.includes('Join us now')
}

export const extractOutboundApplyUrl = (html) => {
  const match = String(html ?? '').match(OUTBOUND_APPLY_PATTERN)
  return match?.[1] || null
}

export const hasPublicJobListingSignal = (html) =>
  PUBLIC_JOB_LISTING_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createTestpressScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Testpress verified official homepage no longer matches the trusted first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Testpress verified about page no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Testpress verified careers page no longer matches the trusted first-party surface')
    }

    if (!extractOutboundApplyUrl(careersHtml)) {
      throw new Error('Testpress careers page no longer exposes the verified outbound apply handoff')
    }

    if (hasPublicJobListingSignal(careersHtml)) {
      throw new Error('Testpress careers page now appears to expose public job records')
    }

    return []
  },
})

export const run = async (options = {}) => createTestpressScraper().run(options)

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
