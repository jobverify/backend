import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runNativeFlywire,CAREERS} from './native.js'
export {parseBinding,parsePage,parseNativeDetail,parseIndiaPage} from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "flywire"
export const COMPANY = "Flywire"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'official-native-workday-board-publication-provenance-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Reconciles the exact corporate Workday handoff, public native listing and full India details with typed countries and native JobPosting metadata. Original publication provenance and application access remain unqualified.'

export const run = options => runNativeFlywire(options)

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
