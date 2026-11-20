import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentPublications } from './currentPublished20261120.js'

// Historical helper exports remain available. Production uses only current
// original native Responses; historical notes are not live publication proof.
export * from './historicalBoundary20261103.js'

export const SOURCE = "simpliwork"
export const COMPANY = "Simpliwork"
export const CAREERS_URL = "https://simpliwork.com/careers/"
export const DISPOSITION = 'current-own-SSR-partial-publications'
export const createSimpliworkScraper = (defaults = {}) => ({
  run: (options = {}) => runCurrentPublications({ ...defaults, ...options }),
})
export const run = options => createSimpliworkScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
