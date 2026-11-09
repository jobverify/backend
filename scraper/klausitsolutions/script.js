import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import KLAUS_IT_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = KLAUS_IT_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
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

export const hasOfficialKlausCareersSignals = (html = '') => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Careers\s*(?:-|&#8211;|&ndash;|â€“|–)\s*Klaus IT Solutions\s*<\/title>/i.test(page)
    && /MyApiPage/i.test(page)
    && /id=["']txtsearch["']/i.test(page)
    && /id=["']txtcity["']/i.test(page)
}

export const pageExposesStructuredJobListings = (html = '') =>
  /\bjob-card\b/i.test(String(html ?? ''))
  || /<a[^>]+href=["'][^"']*\/careers\/[^/"'][^"']*["'][^>]*>/i.test(String(html ?? ''))

export const createKlausITSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialKlausCareersSignals(careersHtml)) {
      throw new Error('Klaus IT Solutions official careers shell changed; refusing to assume no public listings')
    }

    if (pageExposesStructuredJobListings(careersHtml)) {
      throw new Error('Klaus IT Solutions careers shell now exposes structured public job listings and needs a dedicated scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createKlausITSolutionsScraper().run(options)

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
