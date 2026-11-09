import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'unacademy'

const createConfiguredScraper = () => createDarwinboxScraper({
  companyName: 'Unacademy',
  source: SOURCE,
  origin: 'https://unacademy.darwinbox.in',
})

const scraper = createConfiguredScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

export const createUnacademyScraper = createConfiguredScraper

export const runStandalone = async ({
  argv = process.argv,
  fetchListingPage,
  saveToFile,
  saveToDB,
  ...runOptions
} = {}) => {
  const jobs = await createConfiguredScraper().run({
    fetchListingPage,
    ...runOptions,
  })

  if (argv.includes('--dry-run')) {
    const writeJobsToFile = saveToFile
      ?? (await import('../../scraper-support/utils/saveToDB.js')).saveToFile
    writeJobsToFile(jobs, path.join(currentDir, 'jobs.json'))
    return jobs
  }

  const persistJobsToDb = saveToDB
    ?? (await import('../../scraper-support/utils/saveToDB.js')).saveToDB
  await persistJobsToDb(jobs, SOURCE)
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runStandalone()
}
