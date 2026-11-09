import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HEALTHKART_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HEALTHKART_CATALOG.source
export const COMPANY = HEALTHKART_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = HEALTHKART_CATALOG.officialBrandName
export const CAREERS_URL = HEALTHKART_CATALOG.companyCareerPage
export const COMPANY_DOMAIN = HEALTHKART_CATALOG.companyDomain
export const VERIFIED_ON = HEALTHKART_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = HEALTHKART_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = HEALTHKART_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob openings?\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /teamtailor/i,
  /workable/i,
  /darwinbox/i,
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const hasVerifiedHealthKartCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = extractTitle(page) || ''

  return /buy health/i.test(title)
    && /healthkart/i.test(title)
    && text.includes('about healthkart')
    && text.includes('brand directory')
    && text.includes('sell on healthkart')
    && text.includes('careers')
}

export const hasPublicHealthKartJobSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(text))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'healthkart-official',
  timeoutMs: 15000,
})

export const createHealthKartScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (hasPublicHealthKartJobSignals(careersHtml)) {
      throw new Error('HealthKart careers page now appears to expose a public jobs surface')
    }

    if (!hasVerifiedHealthKartCareersSignal(careersHtml)) {
      throw new Error(
        'HealthKart verified careers page no longer matches the verified public surface',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createHealthKartScraper().run(options)

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
