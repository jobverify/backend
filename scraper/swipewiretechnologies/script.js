import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SWIPEWIRE_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SWIPEWIRE_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Swipe Wire\s*<\/title>/i.test(page)
    && /Seeking Excellent Opportunities\?/i.test(page)
    && /info@swipe-wire\.com/i.test(page)
    && /future projects/i.test(page)
}

export const hasNoStructuredJobListingsSignal = (html = '') => !(
  /\bjob-card\b/i.test(String(html ?? ''))
  || /\bcurrent openings\b/i.test(String(html ?? ''))
  || /<a[^>]+href=["'][^"']*\/jobs\/[^"']*["'][^>]*>\s*Apply Now\s*<\/a>/i.test(String(html ?? ''))
)

export const createSwipewireTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Swipewire Technologies careers page changed materially')
    }

    if (!hasNoStructuredJobListingsSignal(careersHtml)) {
      throw new Error('Swipewire Technologies careers page now exposes structured public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createSwipewireTechnologiesScraper().run(options)

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
