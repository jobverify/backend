import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MPL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MPL_CATALOG.source
export const COMPANY = MPL_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = MPL_CATALOG.officialBrandName
export const HOMEPAGE_URL = MPL_CATALOG.homepageUrl
export const CAREERS_URL = MPL_CATALOG.companyCareerPage
export const COMPANY_DOMAIN = MPL_CATALOG.companyDomain
export const VERIFIED_ON = MPL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = MPL_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = MPL_CATALOG

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

export const hasVerifiedMplHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title.includes('play games on mpl')
    && text.includes('deposits are no longer available on the mpl app')
    && text.includes('in compliance with law, no cash games are available on mpl')
}

export const hasPublicMplJobSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(text))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'mpl-official',
  timeoutMs: 15000,
})

export const createMplScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(CAREERS_URL)

    if (hasPublicMplJobSignals(homepageHtml)) {
      throw new Error('MPL exact-name surface now appears to expose a public jobs surface')
    }

    if (!hasVerifiedMplHomepageSignal(homepageHtml)) {
      throw new Error('MPL exact-name homepage no longer matches the verified homepage surface')
    }

    return []
  },
})

export const run = async (options = {}) => createMplScraper().run(options)

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
