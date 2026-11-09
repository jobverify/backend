import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createGcoreScraper } from './native.js'
import PROVIDER_METADATA from './catalog.js'
export { createGcoreScraper, readGcoreEvidence, verifyOfficialHandoff } from './native.js'
export { PROVIDER_METADATA }

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "gcore"
export const COMPANY = "Gcore"
export const CAREERS_URL = 'https://gcore.com/careers'
export const DISPOSITION = 'native-smartrecruiters-board-observation'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current Gcore careers Toggle-menu/About Open positions control binds the exact Gcore SmartRecruiters board and reciprocal careers page. Native listing/detail/closing reads preserve role identity, explicit typed country and raw employer content. Identity-bound India vacancies with missing native criteria remain partial; complete details require visible original criteria. Company totals and scope remain unresolved.'

export const run = async (options = {}) => createGcoreScraper(options).run(options)

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
