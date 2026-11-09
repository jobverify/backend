import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { AVANTHA_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AVANTHA_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const PARKED_LANDER_URL = PROVIDER_METADATA.officialParkedLanderUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasHomepageRedirectSignal = (html = '') =>
  /window\.location\.href\s*=\s*["']\/lander["']/i.test(String(html ?? ''))

export const hasParkedLanderSignal = (html = '') => {
  const page = String(html ?? '')

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(page)
    && page.includes('img1.wsimg.com/parking-lander')
    && /<div id="root"><\/div>/i.test(page)
  }

export const createAvanthaTechnologiesScraper = ({
  fetchText = defaultFetchText,
} = {}) => ({
  async run() {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasHomepageRedirectSignal(homepageHtml)) {
      throw new Error('Avantha Technologies verified root javascript redirect no longer matches the trusted parked-domain surface')
    }

    const parkedHtml = await fetchText(PARKED_LANDER_URL)
    if (!hasParkedLanderSignal(parkedHtml)) {
      throw new Error('Avantha Technologies verified parked lander no longer matches the trusted first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createAvanthaTechnologiesScraper(options).run()

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
