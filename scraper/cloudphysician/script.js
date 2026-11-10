import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentCloudphysician } from './currentPdf.js'

// Historical public helper exports remain available; the production run below
// uses the current recruitment extractor. Historical notes are not live proof.
export * from './historicalBoundary20261103.js'

export const SOURCE = "cloudphysician"
export const COMPANY = "Cloudphysician"
export const CAREERS_URL = "https://www.cloudphysician.net/careers/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => runCurrentCloudphysician(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
