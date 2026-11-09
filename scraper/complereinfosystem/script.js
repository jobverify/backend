import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import COMPLERE_INFOSYSTEM_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = COMPLERE_INFOSYSTEM_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialComplereCareersSignals = (html = '') => {
  const page = String(html ?? '')

  return /Build Your Career Path \| Explore Opportunities at Complere/i.test(page)
    && /Join Our Team/i.test(page)
    && /How to Apply/i.test(page)
    && /hr@complereinfosystem\.com/i.test(page)
}

export const pageExposesStructuredJobListings = (html = '') =>
  /\b(job-card|job-listing|current-opening)\b/i.test(String(html ?? ''))
  || /<a[^>]+href=["'][^"']*(?:\/careers?\/|\/jobs?\/)[^"']*["'][^>]*>\s*(?:apply now|view details|read more)\s*<\/a>/i.test(String(html ?? ''))

export const createComplereInfosystemScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialComplereCareersSignals(careersHtml)) {
      throw new Error('Complere Infosystem official careers surface changed; refusing to assume no public listings')
    }

    if (pageExposesStructuredJobListings(careersHtml)) {
      throw new Error('Complere Infosystem careers page now exposes structured public job listings and needs a dedicated scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createComplereInfosystemScraper().run(options)

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
