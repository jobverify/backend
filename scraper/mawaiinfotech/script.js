import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /IT Careers \| Join Our Team \| SAP Openings/i.test(page)
    && /Career at Mawai/i.test(text)
    && /Your Gateway to a Rewarding Career in SAP Solutions/i.test(text)
    && /Career Opportunities/i.test(text)
}

export const extractRoleCategories = (html = '') =>
  ['SAP Consultants', 'Project Managers', 'Sales and Business Development Professionals', 'Technical Experts']
    .filter((title) => new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(String(html ?? '')))

const hasPublicOpeningSignal = (html = '') =>
  /Job Code\s*:|View Job|More Details|<a[^>]+href="[^"]*\/jobs\//i.test(String(html ?? ''))

export const createMawaiInfotechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Mawai Infotech careers page no longer matches the verified first-party surface')
    }

    if (hasPublicOpeningSignal(careersHtml)) {
      throw new Error('Mawai Infotech generic role categories no longer match the verified fail-closed contract')
    }

    const categories = extractRoleCategories(careersHtml)
    if (categories.length < 4) {
      throw new Error('Mawai Infotech careers page no longer matches the generic role categories contract')
    }

    return []
  },
})

export const run = async (options = {}) => createMawaiInfotechScraper().run(options)

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
