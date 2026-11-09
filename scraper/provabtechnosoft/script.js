import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { PROVAB_TECHNOSOFT_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
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

export const hasOfficialJobsPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Apply For Open Positions')
    && normalized.includes('Applying For')
}

export const extractRoleOptions = (html = '') => {
  const selectMatch = String(html ?? '').match(/<select[^>]+name="jobtype"[^>]*>([\s\S]*?)<\/select>/i)
  if (!selectMatch) return []

  return [...selectMatch[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]+)<\/option>/gi)]
    .map(([, value, label]) => normalizeWhitespace(label || value))
    .filter((label) => label && !/^Applying For$/i.test(label))
}

const hasUnexpectedJobLink = (html = '') =>
  /<a[^>]+href="https:\/\/www\.provab\.com\/jobs\/[^"]+"[^>]*>[^<]+<\/a>/i.test(String(html ?? ''))

export const createProvabTechnosoftScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const jobsHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialJobsPageSignal(jobsHtml)) {
      throw new Error('The verified Provab Technosoft jobs form page changed materially')
    }

    const roleOptions = extractRoleOptions(jobsHtml)
    if (roleOptions.length === 0) {
      throw new Error('The verified Provab Technosoft application form no longer exposes the expected role dropdown')
    }

    if (hasUnexpectedJobLink(jobsHtml)) {
      throw new Error('The verified Provab Technosoft generic application form changed into a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createProvabTechnosoftScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
