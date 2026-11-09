import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cccunderwaterengineeringabudhabi'
export const COMPANY = 'CCC Underwater Engineering, Abu Dhabi'
export const HOMEPAGE_URL = 'https://www.ccc.net/'
export const CONTACT_URL = 'https://www.ccc.net/connect-with-us/'
export const CAREERS_URL = 'https://www.ccc.net/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'Building Legacies, Honoring Values',
  'Our 70+ Year Journey of Excellence',
  'Join Our Team and Build Your Future',
]

const CONTACT_SIGNALS = [
  'Connect with us',
  'Contact',
  'All over the Globe.',
  'UAE, Abu Dhabi',
  'UAE, CCC (Underwater Engineering) SAL',
  'CCC Yard, Building 15 Street 7, West 2, Plot 2B Corniche Road, Musaffah Industrial Area, Abu Dhabi P.O. Box 38522, Abu Dhabi',
  'Submit your CV',
]

const CAREERS_SIGNALS = [
  'Careers',
  'Join Our Team and Build Your Future',
  'Send us your CV',
  'Area of Interest',
  'CV *',
  'employees worldwide',
  'area offices',
  'Terms and Conditions',
]

const PUBLIC_JOB_LISTINGS_PATTERNS = [
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob search\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\brequisition id\b/i,
  /\bjob location\b/i,
  /\bjob category\b/i,
  /<a[^>]+href=["'][^"']*(?:\/jobs?\/|\/job\/|\/careers\/jobs)[^"']*["'][^>]*>/i,
  /<article[^>]+class=["'][^"']*job[^"']*["'][^>]*>/i,
]

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, '\'')
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasAllSignals = (html, signals) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return signals.every((signal) => normalized.includes(normalizeWhitespace(signal).toLowerCase()))
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return hasAllSignals(page, HOMEPAGE_SIGNALS)
    && /<title>\s*Building Legacies,\s*Honoring Values\s*\|\s*CCC\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.ccc\.net\/careers\/["']/i.test(page)
    && /href=["']https:\/\/www\.ccc\.net\/connect-with-us\/["']/i.test(page)
}

export const hasVerifiedContactSignal = (html) => {
  const page = String(html ?? '')
  return hasAllSignals(page, CONTACT_SIGNALS)
    && /<title>\s*Connect with us\s*\|\s*Building Legacies,\s*Honoring Values\s*\|\s*CCC\s*<\/title>/i.test(page)
}

export const extractSubmitCvUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = normalizeWhitespace(match[2])
    if (!/submit your cv/i.test(label)) continue

    try {
      return new URL(match[1], CONTACT_URL).toString()
    } catch {
      continue
    }
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return hasAllSignals(page, CAREERS_SIGNALS)
    && /<title>\s*Careers\s*\|\s*Building Legacies,\s*Honoring Values\s*\|\s*CCC\s*<\/title>/i.test(page)
}

export const hasPublicJobListingsSignal = (html) =>
  PUBLIC_JOB_LISTINGS_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createCccUnderwaterEngineeringAbuDhabiScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('CCC Underwater Engineering Abu Dhabi verified CCC homepage no longer matches the known first-party surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasVerifiedContactSignal(contactPage.html)) {
      throw new Error('CCC Underwater Engineering Abu Dhabi verified group contact page no longer identifies the Abu Dhabi underwater entity')
    }

    const submitCvUrl = extractSubmitCvUrl(contactPage.html)
    if (submitCvUrl !== CAREERS_URL) {
      throw new Error('CCC Underwater Engineering Abu Dhabi verified careers handoff changed on the official CCC contact page')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('CCC Underwater Engineering Abu Dhabi verified CCC careers CV form no longer matches the known public surface')
    }

    if (hasPublicJobListingsSignal(careersPage.html)) {
      throw new Error('CCC Underwater Engineering Abu Dhabi official careers surface now exposes public job listings and needs a structured scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createCccUnderwaterEngineeringAbuDhabiScraper().run(options)

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
