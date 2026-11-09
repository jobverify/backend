import path from 'path'
import { fileURLToPath } from 'url'
import { attachInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { GojekCoverageGapError, inspectGojekCareersPage } from './nativeObservations.js'

export { inspectGojekCareersPage } from './nativeObservations.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.gojek.io/careers'
export const ALL_JOBS_URL = 'https://www.gojek.io/careers/all'
export const GOTO_CAREERS_URL = 'https://www.gotocompany.com/careers'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const buildSearchUrl = () => CAREER_PAGE_URL

export const pageIndicatesSecurityCheckpoint = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('vercel security checkpoint')
}

export const extractGotoBundleUrl = (html) => {
  const match = String(html ?? '').match(/\/_next\/static\/chunks\/pages\/careers-[^"' ]+\.js/)
  if (!match) return null

  return new URL(match[0], GOTO_CAREERS_URL).toString()
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

export const createGojekScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, onAudit = () => {}, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const gojekPage = await fetchPage(buildSearchUrl(), { signal })
    signal?.throwIfAborted()
    if (gojekPage?.status !== 200 || gojekPage.url != null && gojekPage.url !== CAREER_PAGE_URL || typeof gojekPage.text !== 'string') {
      const reason = 'Careers HTTP response is blocked, unavailable or has a changed final URL; parent HoldCo signals cannot establish an empty Gojek inventory'
      throw Object.assign(new GojekCoverageGapError(reason), {
        status: gojekPage?.status ?? null, requestUrl: CAREER_PAGE_URL, finalUrl: gojekPage?.url ?? null,
        failureKind: 'incomplete_listing', source: 'gojek', sourceListingComplete: false, sourceScopeComplete: false,
        inventoryEvidence: normalizeInventoryEvidence({status: 'coverage-gap', surface: CAREER_PAGE_URL,
          firstParty: false, listingComplete: false, pagesFetched: 1, reportedTotal: null, indiaFacetCount: null,
          verifiedAt: now(), reason}),
      })
    }
    const audit = inspectGojekCareersPage(gojekPage.text)
    await onAudit(structuredClone(audit))
    signal?.throwIfAborted()
    if (!audit.expectedPageTitleObserved || audit.observations.length === 0) {
      throw new GojekCoverageGapError('Careers identity or declared native models changed; inventory requires verification')
    }
    const jobs = []
    Object.defineProperty(jobs, 'sourceAudit', { value: audit })
    return attachInventoryEvidence(jobs, {
      status: 'discovery-only', surface: CAREER_PAGE_URL, firstParty: false, listingComplete: false,
      pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'gojek-declared-model-criteria-retained-employer-country-rendering-and-closing-scope-unresolved',
    })
  },
})

export const run = async (options = {}) => createGojekScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Gojek scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'gojek')
    console.log('DB result:', result)
    process.exit(0)
  }
}
