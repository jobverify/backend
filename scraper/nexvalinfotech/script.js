import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

import NEXVAL_INFOTECH_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NEXVAL_INFOTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFICATION_URLS = [
  CAREERS_URL,
  'https://www.nexval.ai/career/',
  'https://www.nexval.ai/jobs/',
  'https://www.nexval.ai/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

const isAcceptedVerificationUrl = (value) =>
  VERIFICATION_URLS.some((url) => {
    try {
      return new URL(value).toString() === new URL(url).toString()
    } catch {
      return false
    }
  })

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.nexval\.ai\/?["']/i.test(page)

  return /<title[^>]*>\s*AI-First Mortgage BPO,\s*Products\s*(?:&amp;|&)\s*Cloud Services\s*<\/title>/i.test(page)
    && hasCanonical
    && /linkedin\.com\/company\/nexval/i.test(page)
    && /Venture into the new age of AI\./i.test(text)
    && /Nexval streamlines mortgage workflows, optimizes processes, and turns data into decisions\./i.test(text)
    && /Contact Nexval/i.test(text)
}

export const hasBlockedCareersRouteSignal = ({ status, url, html } = {}) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return status === 403
    && isAcceptedVerificationUrl(url)
    && (/<Code>\s*AccessDenied\s*<\/Code>/i.test(page) || /access denied/i.test(text))
}

export const createNexvalInfotechScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Nexval Infotech verified official homepage no longer matches the trusted live domain')
    }

    for (const url of VERIFICATION_URLS) {
      const page = await fetchPage(url)
      if (!hasBlockedCareersRouteSignal(page)) {
        throw new Error('Nexval Infotech public jobs surface changed materially; replace the fail-closed sentinel')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNexvalInfotechScraper().run(options)

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
