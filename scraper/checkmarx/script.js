import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runNativeCheckmarx} from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "checkmarx"
export const COMPANY = "Checkmarx"
export const CAREERS_URL = 'https://checkmarx.com/company/careers/'
export const DISPOSITION = 'current-public-Comeet-native-board-company-scope-partial'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current native public company identity, typed geography, full descriptions and public role visibility are reconciled each run. Company-wide counts remain unknown.'

export const run = options => runNativeCheckmarx(options)

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
