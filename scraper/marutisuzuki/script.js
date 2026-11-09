import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'marutisuzuki'
export const COMPANY = 'Maruti Suzuki India Limited'
export const CAREERS_URL = 'https://www.marutisuzuki.com/corporate/careers'
export const APPLY_PORTAL_URL = 'https://maruti.app.param.ai/jobs/'
export const CAREER_NOTICE_URL = 'https://www.marutisuzuki.com/corporate/careers/join-us/career-notice'

const ARCHIVED_PROGRAM_URL = 'https://maruti.app.param.ai/jobs/all-india-hiring-2023-20-btech-and-mtech'
const EXPECTED_APPLY_URLS = [
  APPLY_PORTAL_URL,
  ARCHIVED_PROGRAM_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtml(value), CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  const hasLegacyCareersHubSignals = normalized.includes('work with maruti suzuki')
    && normalized.includes('freshers')
    && normalized.includes('experienced professionals')
    && normalized.includes('workmen hiring (iti)')
  const hasCurrentCareersHubSignals = normalized.includes('come, join us! the future of mobility needs you')
    && normalized.includes('life at msil')
    && normalized.includes('why work with us')
    && normalized.includes('better opportunities')
    && normalized.includes('learning & development')
    && normalized.includes('care & love')
    && normalized.includes('maximize potential')
    && normalized.includes('join us')
    && normalized.includes('see open positions')
    && normalized.includes('freshers')
    && normalized.includes('all india engineering hiring')
    && normalized.includes('experienced professionals')
    && normalized.includes('workmen hiring (iti)')

  return normalized.includes('career - life at maruti suzuki india limited')
    && (hasLegacyCareersHubSignals || hasCurrentCareersHubSignals)
}

export const extractApplyUrls = (html) => {
  const seen = new Set()
  const urls = []

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !/^https:\/\/maruti\.app\.param\.ai\/jobs(?:\/|$)/i.test(absoluteUrl)) {
      continue
    }

    if (seen.has(absoluteUrl)) continue

    seen.add(absoluteUrl)
    urls.push(absoluteUrl)
  }

  return urls
}

const hasExpectedApplyUrls = (urls) =>
  urls.length === EXPECTED_APPLY_URLS.length
  && EXPECTED_APPLY_URLS.every((url) => urls.includes(url))

export const hasArchivedApplyOnlySignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  const applyUrls = extractApplyUrls(html)
  const rawHtml = String(html ?? '')
  const hasCurrentCareerNoticeLink = /href=["']https:\/\/www\.marutisuzuki\.com\/corporate\/careers\/join-us\/career-notice["']/i.test(rawHtml)

  const hasLegacyArchivedApplyOnlySignals = hasExpectedApplyUrls(applyUrls)
    && normalized.includes('all india engineering hiring 2023')
    && normalized.includes('last date for application: july 16, 2023, 23:59 hrs')
    && normalized.includes('passing year 2019, 2020 & 2021')
    && normalized.includes('we will be maintaining your resume in our database')
  const hasCurrentGenericApplyOnlySignals = applyUrls.length === 1
    && applyUrls[0] === APPLY_PORTAL_URL
    && hasCurrentCareerNoticeLink
    && normalized.includes('view all open positions')
    && normalized.includes('freshers')
    && normalized.includes('all india engineering hiring')
    && normalized.includes('experienced professionals')
    && normalized.includes('workmen hiring (iti)')
    && normalized.includes('pan india / hybrid')

  return hasLegacyArchivedApplyOnlySignals || hasCurrentGenericApplyOnlySignals
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMarutiSuzukiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Maruti Suzuki careers page no longer matches the verified official public careers surface')
    }

    if (!hasArchivedApplyOnlySignal(careersHtml)) {
      throw new Error('Maruti Suzuki public careers surface now exposes live openings or changed shape')
    }

    return []
  },
})

export const run = async (options = {}) => createMarutiSuzukiScraper().run(options)

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
