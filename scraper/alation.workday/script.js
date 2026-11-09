import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

import PROVIDER_METADATA from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }

export const run = async ({ signal } = {}) =>
  runWorkdayScraper({
    company: PROVIDER_METADATA.companyName,
    baseUrl: PROVIDER_METADATA.baseUrl,
    locationCountry: PROVIDER_METADATA.locationCountry,
    source: PROVIDER_METADATA.source,
    scraperDir: currentDir,
    ...(signal === undefined ? {} : { signal }),
  })

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, PROVIDER_METADATA.source)
  }
}
