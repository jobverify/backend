import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createEtihadScraper } from './native.js'
export { createEtihadScraper, readEtihadEvidence } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "etihadairways"
export const COMPANY = "Etihad Airways"
export const CAREERS_URL = 'https://careers.etihad.com/'
export const DISPOSITION = 'native-smartrecruiters-board-observation'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Validate the current visible official Etihad hiring handoff, reciprocal native board, every native role/company/country and staged listing reconciliation. Hydrate only public native India roles and preserve original or missing criteria. Native board observations never establish whole-company or India-empty inventory.'

export const run = async (options = {}) => createEtihadScraper(options).run(options)

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
