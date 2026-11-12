import path from 'path'
import { fileURLToPath } from 'url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createThermoFisherFetchText } from './nativeDetailTransport.js'
import { reviewedPhenomTitleBindingsForSource } from '../../scraper-support/phenom/reviewedTitleBindings20261108.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'Thermo Fisher Scientific',
  source: 'thermofisherscientific',
  baseUrl: 'https://jobs.thermofisher.com',
  searchPath: '/global/en/search-results',
  listingPredicate: (listing) => listing?.country === 'India',
  scraperDir: currentDir,
  nativeBoundModelTitlePreference: true,
  // Captured primary/standardized country and both typed native/schema offices agree.
  nativeReviewedMultiCountryDerivedConflicts: [{ jobId: 'R-01369441', derivedCountry: 'Sierra Leone',
    officeCountries: ['India', 'Philippines'] }],
  nativeReviewedTitleBindings: reviewedPhenomTitleBindingsForSource('thermofisherscientific'),
  nativeLocalizedCountryNames: [{ locale: 'ja', region: 'IN' }, { locale: 'de', region: 'IN' },
    { locale: 'zh', region: 'IN' }, { locale: 'hr', region: 'IN' }, { locale: 'pl', region: 'IN' },
    { locale: 'fr', region: 'IN' }, { locale: 'it', region: 'PH' }],
})

export const {
  buildSearchResultsPageUrl,
  buildJobDetailUrl,
  extractSearchPayload,
  extractSearchResults,
  extractJobDetail,
} = scraper

export const run = (options = {}) => scraper.run({
  ...options,
  useWidgetApi: options.useWidgetApi ?? Boolean(options.fetchJson || !options.fetchText),
  fetchText: options.fetchText || createThermoFisherFetchText({
    fetchImpl: options.fetchImpl, sleep: options.nativeThrottleSleep, config: loadConfig(currentDir),
  }),
})

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Thermo Fisher Scientific scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'thermofisherscientific')
    console.log('DB result:', result)
    process.exit(0)
  }
}
