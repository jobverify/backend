import path from 'path'
import { fileURLToPath } from 'url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const scraper = createPhenomScraper({
  companyName: 'Rocket Companies',
  source: 'rocketindia',
  baseUrl: 'https://careers.rocket.com',
  // Rocket India's homepage links a separate regional board and Workday apply site.
  searchPath: '/in/en/search-results',
  scraperDir: currentDir,
  defaultDetailConcurrency: 2,
})

export const {
  buildSearchResultsPageUrl,
  buildJobDetailUrl,
  extractSearchPayload,
  extractSearchResults,
  extractJobDetail,
} = scraper

// These literal native descriptions are internal request labels, without role
// duties or requirements. Matching the detail identity cannot make them full JDs.
const hasNativeCriteria = description => typeof description === 'string' && description.trim()
  && !/^(?:Business Requirement\.?|For (?:Rocket|XOME) India\.?)$/i.test(description.trim())

export const run = async (options = {}) => {
  const jobs = await scraper.run(options)
  const missingCriteriaIds = []
  for (const job of jobs) {
    if (job.sourceDetailComplete === true && hasNativeCriteria(job.jobDescription)) continue
    missingCriteriaIds.push(job.jobId)
    job.sourceDetailComplete = false
    job.sourceDescriptionMissing = true
    job.sourceDetailFailureKind ||= 'missing-content'
    job.jobDescription = null
  }
  if (!missingCriteriaIds.length) return jobs
  for (const job of jobs) {
    job.sourceListingComplete = false
    job.sourceScopeComplete = false
    job.lifecycleCleanupAllowed = false
  }
  return attachInventoryEvidence(jobs, { ...readInventoryEvidence(jobs), status: 'coverage-gap',
    listingComplete: false, indiaFacetCount: null,
    reason: (readInventoryEvidence(jobs)?.reason || 'native-regional-board')
      + '; unavailable-native-full-criteria:' + missingCriteriaIds.join(',') })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Rocket India scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'rocketindia')
    console.log('DB result:', result)
    process.exit(0)
  }
}
