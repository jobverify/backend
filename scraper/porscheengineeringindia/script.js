import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { PORSCHE_ENGINEERING_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareerPortalShell = (html = '') => {
  const page = String(html ?? '')
  return /career-portal/i.test(page)
    && /search for jobs/i.test(page)
    && /keyword/i.test(page)
    && /country/i.test(page)
    && /location/i.test(page)
}

export const hasPublicListingSignal = (html = '') =>
  /(?:ac=jobad|job-code\s*:)/i.test(String(html ?? ''))

export const createPorscheEngineeringIndiaScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (hasPublicListingSignal(html)) {
      throw new Error('Porsche Engineering India official portal now exposes a public listing surface; replace the sentinel with an enumerating scraper')
    }

    if (!hasOfficialCareerPortalShell(html)) {
      throw new Error('Porsche Engineering India official career portal no longer matches the verified non-enumerable shell')
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only',
      surface: CAREERS_URL,
      firstParty: true,
      listingComplete: false,
      pagesFetched: 1,
      reportedTotal: 0,
      indiaFacetCount: 0,
      verifiedAt: now(),
      reason: 'porsche-engineering-india-non-enumerable-career-portal-shell',
    })
  },
})

export const run = async (options = {}) => createPorscheEngineeringIndiaScraper().run(options)

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
