import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { BATTRE_ELECTRIC_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BATTRE_ELECTRIC_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
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
  const hasBattreBrand = /Batt\s*:?\s*RE(?:\s+Electric(?:\s+Mobility)?)?/i.test(page)
  const hasPublicJobSurface = /\b(careers?|jobs?|open positions|vacancies|apply now)\b/i.test(page)

  return hasBattreBrand && !hasPublicJobSurface
}

export const isBlockedNetworkError = (error) => /connect timeout|und_err_connect_timeout/i.test(
  `${error?.message ?? ''} ${error?.cause?.message ?? ''} ${error?.cause?.code ?? ''}`,
)

export const createBattreelectricScraper = () => ({
  async run({ dryRun = false, fetchText = defaultFetchText } = {}) {
    if (dryRun) return []

    let homepageHtml

    try {
      homepageHtml = await fetchText(HOMEPAGE_URL)
    } catch (error) {
      if (isBlockedNetworkError(error)) {
        return []
      }

      throw error
    }

    if (!hasVerifiedOfficialSurface(homepageHtml)) {
      throw new Error(
        `BattRE Electric verified first-party surface changed materially: ${HOMEPAGE_URL}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createBattreelectricScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run({ dryRun: isDryRun })

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
