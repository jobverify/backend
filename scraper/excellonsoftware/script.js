import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { EXCELLON_SOFTWARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EXCELLON_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Work with us\s*\|\s*Excellon Careers\s*<\/title>/i.test(page)
    && normalized.includes('Join a Team That’s Redefining Growth and Challenging the Status Quo')
    && normalized.includes('Apply Now')
    && normalized.includes('Submit Job Application')
}

export const hasPublicJobListingSignal = (html = '') => /data-job-id=|Current Openings|Open Roles/i.test(
  String(html ?? ''),
)

export const createExcellonSoftwareScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    } = {}) {
      const careersHtml = await fetchText(CAREERS_URL)

      if (hasPublicJobListingSignal(careersHtml)) {
        throw new Error('The verified Excellon careers page now exposes live public job listings')
      }

      if (!hasVerifiedCareersSignal(careersHtml)) {
        throw new Error('The verified Excellon careers page no longer matches the trusted first-party surface')
      }

      return []
    },
  })

export const run = async (options = {}) => createExcellonSoftwareScraper().run(options)

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
