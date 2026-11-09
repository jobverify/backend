import { createCurrentAmber } from "./currentPublic.js"
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'amberenterprises'
export const COMPANY = 'Amber Enterprises'
export const HOMEPAGE_URL = 'https://www.ambergroupindia.com/'
export const CAREERS_URL = 'https://www.ambergroupindia.com/careers/'
export const EXTERNAL_JOBS_HOST = 'www.naukri.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*Amber Group India\s*\|\s*AC,\s*(?:Electronics\s*&amp;\s*)?Mobility Solutions(?:\s+Manufacturer)?\s*<\/title>/i
const HOMEPAGE_MOBILITY_PATTERN = /Mobility Solutions/i
const HOMEPAGE_CAREERS_LINK_PATTERN = /href=["'][^"']*\/careers\/?["']/i

const CAREERS_TITLE_PATTERN = /<title>\s*Careers at Amber Group\b[\s\S]*?<\/title>/i
const CAREERS_OPENINGS_PATTERN = /View Current Openings/i
const CAREERS_UPLOAD_RESUME_PATTERN = /Upload Resume/i
const CAREERS_FILE_INPUT_PATTERN = /type=["']file["']/i
const NAUKRI_HANDOFF_PATTERN = /href=["']https?:\/\/www\.naukri\.com\/[^"']*["']/i

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return HOMEPAGE_TITLE_PATTERN.test(page)
    && HOMEPAGE_MOBILITY_PATTERN.test(page)
    && HOMEPAGE_CAREERS_LINK_PATTERN.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return CAREERS_TITLE_PATTERN.test(page)
    && HOMEPAGE_CAREERS_LINK_PATTERN.test(page)
    && CAREERS_OPENINGS_PATTERN.test(page)
    && CAREERS_UPLOAD_RESUME_PATTERN.test(page)
    && CAREERS_FILE_INPUT_PATTERN.test(page)
}

export const hasExternalJobsHandoffSignal = (html) => {
  const page = String(html ?? '')
  return CAREERS_OPENINGS_PATTERN.test(page) && NAUKRI_HANDOFF_PATTERN.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createAmberEnterprisesScraper = () => createCurrentAmber()

export const run = async (options = {}) => createAmberEnterprisesScraper().run(options)

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
