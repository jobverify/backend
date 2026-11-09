import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CLOUD4C_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CLOUD4C_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_FORM_URL = PROVIDER_METADATA.applicationFormUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Cloud4C Makes a Difference. For the Industry and its Brightest Talents')
    && normalized.includes('Discover your new career that makes you happy')
    && /href="https:\/\/careers\.cloud4c\.com\/go\/All-Jobs\/517580\/"/i.test(String(html))
    && normalized.includes("Couldn't find the right opportunity? Write to us")
}

export const isGenericApplicationForm = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Application form')
    && normalized.includes('Job Title*')
    && normalized.includes('Job Location*')
    && normalized.includes('Name*')
    && normalized.includes('Experience*')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCloud4CScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Cloud4C verified careers page no longer matches the trusted first-party contract')
    }

    const applicationFormHtml = await fetchText(APPLICATION_FORM_URL)
    if (!isGenericApplicationForm(applicationFormHtml)) {
      throw new Error('Cloud4C application form no longer matches the verified generic no-openings contract')
    }

    return []
  },
})

export const run = async (options = {}) => createCloud4CScraper().run(options)

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
