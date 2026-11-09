import path from 'path'
import { fileURLToPath } from 'url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { reviewedPhenomTitleBindingsForSource } from '../../scraper-support/phenom/reviewedTitleBindings20261108.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'Juniper Networks',
  source: 'juniper',
  baseUrl: 'https://careers.hpe.com',
  searchPath: '/juniper',
  jobPathPrefix: '/us/en',
  scraperDir: currentDir,
  nativeBoundModelTitlePreference: true,
  nativeReviewedTitleBindings: reviewedPhenomTitleBindingsForSource('juniper'),
})

export const {
  buildSearchResultsPageUrl,
  buildJobDetailUrl,
  extractSearchPayload,
  extractSearchResults,
  extractJobDetail,
} = scraper

const LANDING_KEY = 'l-hpe-juniper-networking'
const LANDING_QUERY = '(description.description_phenom:("#networking"))'

// The official Juniper page advertises targetedJobs with this landing-page key.
// Fetch its verified larger response through the existing complete-inventory checks.
export const run = (options = {}) => {
  const getJson = options.fetchJson || fetchJsonWithRetry
  const getDetailText = options.fetchText || fetchTextWithRetry
  return scraper.run({
    ...options,
    useWidgetApi: false,
    fetchText: async (url, requestOptions = {}) => {
      const parsedUrl = new URL(url)
      if (parsedUrl.origin !== 'https://careers.hpe.com' || parsedUrl.pathname !== '/juniper') {
        return getDetailText(url, { ...requestOptions, attempts: 1, timeoutMs: 15000, label: 'juniper detail' })
      }
      const response = await getJson('https://careers.hpe.com/widgets', {
        ...requestOptions,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        attempts: 2, timeoutMs: 15000, label: 'juniper listings',
        body: JSON.stringify({lang: 'en_us', deviceType: 'desktop', country: 'us',
          pageName: 'HPE Juniper Networking', ddoKey: 'targetedJobs', jobs: true,
          lpKey: [LANDING_KEY], size: 500, from: Number(parsedUrl.searchParams.get('from') || 0),
        }),
      })
      const payload = response?.targetedJobs
      if (payload?.status !== 200 || !Array.isArray(payload.data?.jobs)) {
        throw new Error('PHENOM_INCOMPLETE_SNAPSHOT: Juniper public widget returned an invalid listing payload')
      }
      if (payload.lpKey !== LANDING_KEY || payload.eid?.searchType !== 'landingPage' || payload.eid?.query !== LANDING_QUERY) {
        throw new Error('PHENOM_INCOMPLETE_SNAPSHOT: Juniper public widget lost its official landing-page scope')
      }
      return '<script>phApp.ddo = ' + JSON.stringify({ targetedJobs: payload }) + '</script>'
    },
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Juniper scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'juniper')
    console.log('DB result:', result)
    process.exit(0)
  }
}
