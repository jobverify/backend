import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import SEPC_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SEPC_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage

export const hasPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')

  return /<ul[^>]+class=["'][^"']*FYpdf[^"']*["'][^>]*>[\s\S]*?<li\b/i.test(page)
    || /"@type"\s*:\s*"JobPosting"/i.test(page)
    || /\bapply now\b/i.test(page)
}

export const hasVerifiedEmptyCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Shriram EPC \| Careers\s*<\/title>/i.test(page)
    && /\bCURRENT OPENINGS\b/i.test(page)
    && /COPYRIGHT\s+©\s+SEPC LTD/i.test(page)
    && /<ul[^>]+class=["'][^"']*FYpdf[^"']*["'][^>]*>\s*<\/ul>/i.test(page)
    && !hasPublicJobsSignal(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'sepc-html',
  timeoutMs: 15000,
})

export const createSepcScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (hasPublicJobsSignal(careersHtml)) {
      throw new Error('SEPC careers page now appears to expose public jobs')
    }

    if (!hasVerifiedEmptyCareersSignal(careersHtml)) {
      throw new Error('Verified SEPC careers page changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createSepcScraper().run(options)

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
