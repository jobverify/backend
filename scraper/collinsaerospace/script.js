import path from 'path'
import { fileURLToPath } from 'url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { reviewedPhenomTitleBindingsForSource } from '../../scraper-support/phenom/reviewedTitleBindings20261108.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'Collins Aerospace',
  source: 'collinsaerospace',
  baseUrl: 'https://careers.rtx.com',
  searchPath: '/global/en/collins-aerospace-search-results-general',
  listingPredicate: (job) => job.businessUnit === 'Collins Aerospace',
  scraperDir: currentDir,
  nativeBoundModelTitlePreference: true,
  nativeReviewedTitleBindings: reviewedPhenomTitleBindingsForSource('collinsaerospace'),
})

export const {
  buildSearchResultsPageUrl,
  buildJobDetailUrl,
  extractSearchPayload,
  extractSearchResults,
  extractJobDetail,
} = scraper

// The current public landing page advertises this widget and its businessUnit
// and country facets. Feed its DDO envelope through the shared inventory checks
// so pagination, cancellation and optional detail budgets have one owner.
export const run = (options = {}) => {
  const getJson = options.fetchJson || fetchJsonWithRetry
  const getDetailText = options.fetchText || fetchTextWithRetry
  return scraper.run({
    ...options,
    useWidgetApi: false,
    fetchText: async (url, requestOptions = {}) => {
      const parsedUrl = new URL(url)
      if (parsedUrl.origin !== 'https://careers.rtx.com'
        || parsedUrl.pathname !== '/global/en/collins-aerospace-search-results-general') {
        return getDetailText(url, { ...requestOptions, attempts: 1, timeoutMs: 15000, label: 'collinsaerospace detail' })
      }
      const response = await getJson('https://careers.rtx.com/widgets', {
        ...requestOptions,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        attempts: 2,
        timeoutMs: 15000,
        label: 'collinsaerospace listings',
        body: JSON.stringify({
          lang: 'en_global', deviceType: 'desktop', country: 'global',
          pageName: 'search-results', ddoKey: 'refineSearch', jobs: true, counts: true,
          all_fields: ['country', 'businessUnit'], size: 100, global: true, keywords: '',
          sortBy: 'Most recent', sort: { field: 'postedDate', order: 'desc' },
          selected_fields: { country: ['India'], businessUnit: ['Collins Aerospace'] },
          from: Number(parsedUrl.searchParams.get('from') || 0),
        }),
      })
      const payload = response?.refineSearch
      if (payload?.status !== 200 || !Array.isArray(payload.data?.jobs)) {
        throw new Error('PHENOM_INCOMPLETE_SNAPSHOT: Collins public widget returned an invalid listing payload')
      }
      if (payload.data.jobs.some((job) => job?.businessUnit !== 'Collins Aerospace')) {
        throw new Error('PHENOM_INCOMPLETE_SNAPSHOT: Collins public widget lost its division scope')
      }
      return '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: payload }) + '</script>'
    },
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Collins Aerospace scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'collinsaerospace')
    console.log('DB result:', result)
    process.exit(0)
  }
}
