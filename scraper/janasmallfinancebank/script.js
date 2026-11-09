import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { JANA_SMALL_FINANCE_BANK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = JANA_SMALL_FINANCE_BANK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.currentOpeningsPageUrl
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\/jobs?\//i,
  /\bjob segment\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) =>
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const defaultFetchText = async (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractCurrentOpeningsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    const text = normalizeWhitespace(match[2])?.toLowerCase() || ''

    if (href === CURRENT_OPENINGS_URL) return href
    if (text.includes('current opening')) return CURRENT_OPENINGS_URL
  }

  return null
}

export const hasVerifiedHomepageSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /jana small finance bank/i.test(page)
    && normalized.includes('Jana Small Finance Bank')
    && (normalized.includes('Careers') || normalized.includes('career opportunities'))
}

export const hasVerifiedCareersSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  const hasVerifiedTitle = /<title>\s*(?:careers|jana small finance bank careers)\s*<\/title>/i.test(page)
  const hasVerifiedCurrentOpeningsLink = extractCurrentOpeningsUrl(page) === CURRENT_OPENINGS_URL
  const hasLegacyEmailHandoffSignals = normalized.includes('A career with us is more than just a job.')
    && normalized.includes('Click here to view our current openings')
    && normalized.includes(
      'Jana Small Finance Bank will never ask or accept payment from anyone seeking employment with us.',
    )
  const hasCurrentBrandedCareersSignals = normalized.includes('A culture of learn and grow')
    && normalized.includes('Why choose Jana')
    && normalized.includes('Thinking about joining us?')
    && normalized.includes('Dig in on your first day')
    && normalized.includes('Count on us for career growth')
    && normalized.includes('JANA Small Finance Bank')

  return hasVerifiedTitle
    && hasVerifiedCurrentOpeningsLink
    && (hasLegacyEmailHandoffSignals || hasCurrentBrandedCareersSignals)
}

export const hasVerifiedCurrentOpeningsSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  const hasLegacyEmailHandoffSignals = /<title>\s*current opening\s*<\/title>/i.test(page)
    && normalized.includes('Share your resume with us at careers@jana.bank.in')
    && normalized.includes('mention the Job Role in the subject line')
  const hasCurrentBranded404Signals = /<title>\s*404\s*-\s*category not found\s*<\/title>/i.test(page)
    && normalized.includes('404 - Category not found')
    && normalized.includes('The requested resource was not found.')
    && normalized.includes('Please try one of the following pages: Home Page')

  return hasLegacyEmailHandoffSignals || hasCurrentBranded404Signals
}

export const hasPublicJobSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
}

const isExpectedCurrentOpenings404Error = (error) =>
  /HTTP 404\b/i.test(String(error?.message ?? error))
  && String(error?.message ?? error).includes(CURRENT_OPENINGS_URL)

export const createJanaSmallFinanceBankScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchPage = defaultFetchPage } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasVerifiedHomepageSignals(homepageHtml)) {
      throw new Error(
        'Jana Small Finance Bank verified homepage no longer matches the known first-party surface',
      )
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (hasPublicJobSignals(careersHtml)) {
      throw new Error('Jana Small Finance Bank careers page now appears to expose a public jobs surface')
    }
    if (!hasVerifiedCareersSignals(careersHtml)) {
      throw new Error(
        'Jana Small Finance Bank verified careers page no longer matches the known first-party surface',
      )
    }

    let currentOpeningsHtml
    try {
      currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)
    } catch (error) {
      if (!isExpectedCurrentOpenings404Error(error)) {
        throw error
      }

      const currentOpeningsPage = await fetchPage(CURRENT_OPENINGS_URL)
      if (currentOpeningsPage.status !== 404) {
        throw error
      }

      currentOpeningsHtml = currentOpeningsPage.html
    }

    if (hasPublicJobSignals(currentOpeningsHtml)) {
      throw new Error(
        'Jana Small Finance Bank current openings page now appears to expose a public jobs surface',
      )
    }
    if (!hasVerifiedCurrentOpeningsSignals(currentOpeningsHtml)) {
      throw new Error(
        'Jana Small Finance Bank verified current openings page no longer matches the known first-party surface',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createJanaSmallFinanceBankScraper().run(options)

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
