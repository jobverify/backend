import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INVENIO_BUSINESS_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.officialJobsBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return text.includes('Careers at Invenio')
    && text.includes('Where can I find the current open positions at Invenio?')
    && text.includes('https://jobs.jobvite.com/inveniolsi')
    && text.includes('talent.hr@invenio-solutions.com')
}

export const hasJobviteZeroOpeningsSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return text.includes('Open Positions')
    && text.includes('There are currently no open jobs.')
    && text.includes('General Application')
    && text.includes('Powered by Jobvite')
}

export const hasPublicJobListingsSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return /\/job\/o[a-z0-9]+/i.test(String(html ?? ''))
    || (text.includes('Open Positions') && text.includes('Job listing') && !text.includes('There are currently no open jobs.'))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createInvenioBusinessSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Invenio Business Solutions careers page no longer matches the trusted first-party surface')
    }

    const boardHtml = await fetchText(JOBS_BOARD_URL)
    if (hasJobviteZeroOpeningsSignal(boardHtml)) {
      return []
    }

    if (hasPublicJobListingsSignal(boardHtml)) {
      throw new Error('Invenio Business Solutions public jobs again appear on the Jobvite board')
    }

    throw new Error('The verified Invenio Business Solutions Jobvite zero-openings surface changed materially')
  },
})

export const run = async (options = {}) => createInvenioBusinessSolutionsScraper().run(options)

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
