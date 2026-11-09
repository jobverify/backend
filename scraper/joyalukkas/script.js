import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { JOYALUKKAS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = JOYALUKKAS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedOfficialSurface = (html = '') => {
  const page = String(html ?? '')
  return /Joyalukkas/i.test(page)
    && /Joyalukkas India Limited/i.test(page)
    && !/\b(careers?|jobs?|open positions|vacancies|apply now)\b/i.test(page)
}

export const createJoyalukkasScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const officialSurfaceHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasVerifiedOfficialSurface(officialSurfaceHtml)) {
      throw new Error(
        `Joyalukkas verified first-party surface changed materially: ${OFFICIAL_CAREERS_URL}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createJoyalukkasScraper().run(options)

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
