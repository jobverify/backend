import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { M2P_FINTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = M2P_FINTECH_CATALOG.source
export const COMPANY = M2P_FINTECH_CATALOG.companyName
export const CAREERS_HOME_URL = M2P_FINTECH_CATALOG.careersHomeUrl
export const JOBS_PAGE_URL = M2P_FINTECH_CATALOG.companyCareerPage
export const PROVIDER_METADATA = M2P_FINTECH_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractVisibleText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+([?!,.:;])/g, '$1'),
)

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

export const hasVerifiedCareersHomeSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = extractVisibleText(page)

  return /<title[^>]*>\s*M2P Fintech \| Build your career in fintech with us\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/careers\.m2pfintech\.com\/["']/i.test(
      page,
    )
    && /you.?ll fit right in\./i.test(visibleText || '')
    && /at m2p, we don.?t just work, we build the future of fintech\./i.test(visibleText || '')
    && visibleText?.includes('View Jobs')
    && visibleText?.includes('Join us')
}

export const extractViewJobsUrl = (html) => {
  const page = String(html ?? '')

  for (const match of page.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = normalizeWhitespace(match[2])
    if (!label || !/^View Jobs$/i.test(label)) continue

    return toAbsoluteUrl(match[1], CAREERS_HOME_URL)
  }

  return null
}

export const hasVerifiedZeroJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*M2P Fintech \| Careers \| Job Listing\s*<\/title>/i.test(page)
    && normalized?.includes('Our Job Openings')
    && normalized?.includes('No Jobs Found')
    && normalized?.includes('Keep exploring this space.')
  }

const hasVisiblePublicJobsSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  if (!normalized) return false

  return normalized.includes('Our Job Openings')
    && !normalized.includes('No Jobs Found')
    && (/<article\b/i.test(String(html ?? ''))
      || /class=["'][^"']*job-card[^"']*["']/i.test(String(html ?? ''))
      || /\bApply\b/i.test(normalized))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createM2PFintechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHomeHtml = await fetchText(CAREERS_HOME_URL)
    if (!hasVerifiedCareersHomeSignal(careersHomeHtml)) {
      throw new Error('M2P Fintech verified careers homepage no longer matches the current first-party surface')
    }

    if (extractViewJobsUrl(careersHomeHtml) !== JOBS_PAGE_URL) {
      throw new Error('M2P Fintech verified View Jobs handoff changed materially')
    }

    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)
    if (hasVisiblePublicJobsSignal(jobsPageHtml)) {
      throw new Error('M2P Fintech jobs page now exposes public openings')
    }

    if (!hasVerifiedZeroJobsPageSignal(jobsPageHtml)) {
      throw new Error('M2P Fintech verified zero-openings jobs page no longer matches the current public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createM2PFintechScraper().run(options)

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
