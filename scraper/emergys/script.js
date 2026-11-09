import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runNative} from './native.js'
import {EMERGYS_CATALOG} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "emergys"
export const COMPANY = "Emergys"
export const CAREERS_URL = EMERGYS_CATALOG.companyCareerPage
export const DISPOSITION = 'native-public-role-page-integration'
export const VERIFIED_ON = null
export const PROVIDER_METADATA = EMERGYS_CATALOG
export const VERIFIED_SURFACE_SUMMARY = EMERGYS_CATALOG.verifiedSurfaceSummary

export const run = options=>runNative(options)

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
