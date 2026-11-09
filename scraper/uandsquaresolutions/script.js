import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { U_AND_D_SQUARE_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const REDIRECT_TARGET_URL = PROVIDER_METADATA.redirectTargetUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasRedirectedHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('MSP Square')
    && normalized.includes('About')
    && normalized.includes('Contact')
    && normalized.includes('Managed Helpdesk')
    && normalized.includes('Managed Security SOC')
    && normalized.includes('Resource Bank')
}

export const pageExposesPublicJobListings = (html = '') =>
  /career|careers|jobs|apply now|system administrator/i.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  redirect: 'follow',
  label: SOURCE,
  timeoutMs: 15000,
})

export const createUAndDSquareSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(HOMEPAGE_URL)

    if (!hasRedirectedHomepageSignal(html)) {
      throw new Error('The U&D Square Solutions first-party domain no longer matches the verified MSP Square handoff')
    }

    if (pageExposesPublicJobListings(html)) {
      throw new Error('The U&D Square Solutions first-party domain now exposes public careers or job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createUAndDSquareSolutionsScraper().run(options)

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
