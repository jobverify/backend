import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { GREYTRIX_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GREYTRIX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = String(html).replace(/\s+/g, ' ')

  return normalized.includes('Careers - Greytrix')
    && normalized.includes('Launch your')
    && normalized.includes('PROFESSIONAL JOURNEY with us!')
    && normalized.includes('Join Us')
    && normalized.includes('Job Openings')
    && normalized.includes('Greytrix official emails only come from')
    && normalized.includes('@greytrix.com')
    && /Contact us/i.test(normalized)
}

export const hasPublicJobSignals = (html = '') =>
  /JobPosting|data-job-id=|<article[^>]+itemscope|View Position|Current Openings/i.test(String(html))

export const hasEmbeddedJobsShell = (html = '') =>
  /<iframe\b/i.test(String(html))

export const createGreytrixScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html) || !hasEmbeddedJobsShell(html) || hasPublicJobSignals(html)) {
      throw new Error('The verified Greytrix careers page no longer matches the trusted embedded-jobs sentinel')
    }

    return []
  },
})

export const run = async (options = {}) => createGreytrixScraper().run(options)

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
