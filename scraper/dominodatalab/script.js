import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runNative} from './native.js'
import {DOMINO_CATALOG} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "dominodatalab"
export const COMPANY = "Domino Data Lab"
export const CAREERS_URL = DOMINO_CATALOG.companyCareerPage
export const DISPOSITION = 'native-configuration-bound-shared-Greenhouse-integration'
export const VERIFIED_ON = null
export const PROVIDER_METADATA=DOMINO_CATALOG
export const VERIFIED_SURFACE_SUMMARY=DOMINO_CATALOG.verifiedSurfaceSummary

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
