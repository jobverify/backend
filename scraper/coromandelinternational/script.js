import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'coromandelinternational'
export const COMPANY = 'Coromandel International'
export const CAREERS_URL = 'https://www.coromandel.biz/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers: Explore Job Opportunities at Coromandel\s*(?:-|–|—|&#8211;|&ndash;|&mdash;)\s*Join Us\s*<\/title>/i.test(page)
    && normalized.includes('Work With Us')
    && normalized.includes('Visit Our Linkedin Page')
    && /linkedin\.com\/company\/coromandel-international-limited/i.test(page)
}

export const hasRenderedJobsSignal = (html) => {
  const page = String(html ?? '')

  return /<[^>]+class=["'][^"']*(?:awsm-job-item|awsm-job-listing-item|awsm-job-specification-wrapper)[^"']*["']/i.test(page)
    || /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*JobPosting[\s\S]*<\/script>/i.test(page)
    || /href=["'][^"']*(?:linkedin\.com\/jobs|greenhouse|lever|ashbyhq|myworkdayjobs|workdayjobs|darwinbox)[^"']*["']/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCoromandelInternationalScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Coromandel verified first-party careers shell no longer matches the trusted public surface')
    }

    if (hasRenderedJobsSignal(careersHtml)) {
      throw new Error('Coromandel careers page now appears to expose a concrete public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createCoromandelInternationalScraper().run(options)

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
