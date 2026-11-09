import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hillimited'
export const COMPANY = 'HIL Limited'
export const HOMEPAGE_URL = 'https://www.hil.in/'
export const CAREERS_URL = 'https://birlanu.com/people'
export const VERIFIED_DARWINBOX_URL = 'https://iconnect-hil.darwinbox.in/ms/candidatev2/main/careers/allJobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_SIGNALS = [
  'Growing together',
  'People@BirlaNu',
  'Career@BilraNu',
  'Connect with us to explore exciting career opportunities at BirlaNu.',
]

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

const isFirstPartyUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname === 'birlanu.com' || url.hostname === 'www.birlanu.com'
  } catch {
    return false
  }
}

export const extractJoinUsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Join Us\s*<\/a>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl) {
      return absoluteUrl
    }
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return OFFICIAL_SIGNALS.every((signal) => normalized.includes(signal))
    && normalized.includes('formerly HIL Limited')
}

export const pageExposesFirstPartyJobRecords = (html) => {
  const matches = String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)

  for (const match of matches) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) continue

    if (/\/careers?\//i.test(new URL(absoluteUrl).pathname)) {
      return true
    }
  }

  return /\bcurrent openings\b|\bopen positions\b|\bjob-card\b/i.test(String(html ?? ''))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHilLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('HIL Limited BirlaNu people page no longer matches the verified official careers surface')
    }

    const joinUsUrl = extractJoinUsUrl(careersHtml)
    if (joinUsUrl !== VERIFIED_DARWINBOX_URL) {
      throw new Error('HIL Limited BirlaNu people page no longer links to the verified Darwinbox handoff')
    }

    if (pageExposesFirstPartyJobRecords(careersHtml)) {
      throw new Error('HIL Limited first-party public job records now appear on the verified BirlaNu page')
    }

    return []
  },
})

export const run = async (options = {}) => createHilLimitedScraper().run(options)

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
