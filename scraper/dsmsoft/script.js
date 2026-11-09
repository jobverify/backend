import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DSM_SOFT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = DSM_SOFT_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const TRUSTWORTHY_PUBLIC_JOB_PATTERNS = [
  /<article[^>]*class=["'][^"']*job-card/i,
  /\bapply now\b/i,
  /\bcurrent openings\b/i,
  /\brequisition id\b/i,
  /href=["'][^"']*\/jobs\/[^"']+/i,
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*DSM Soft\s*\|\s*Geospatial\s*\|\s*Engineering\s*\|\s*Prepress\s*\|\s*Telematics Services\s*<\/title>/i
      .test(page)
    && /Welcome to our company/i.test(page)
    && /Your details/i.test(page)
    && /Interested candidates can send the resume to/i.test(page)
    && /hr_team@dsmsoft\.com/i.test(page)
    && /Geospatial/i.test(page)
    && /Engineering/i.test(page)
}

export const pageExposesTrustworthyPublicJobListings = (html = '') =>
  TRUSTWORTHY_PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createDsmSoftScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (pageExposesTrustworthyPublicJobListings(careersHtml)) {
      throw new Error(
        'The verified DSM SOFT careers surface now appears to expose trustworthy public job listings',
      )
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified DSM SOFT careers surface no longer matches the trusted first-party page')
    }

    return []
  },
})

export const run = async (options = {}) => createDsmSoftScraper().run(options)

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
