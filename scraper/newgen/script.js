import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runCurrentPublications} from './currentPublished20261120.js'
import NEWGEN_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "newgen"
export const COMPANY = "Newgen Software"
export const CAREERS_URL = NEWGEN_CATALOG.companyCareerPage
export const DISPOSITION = 'current-own-published-valid-partials'
export const VERIFIED_ON = null
export const PROVIDER_METADATA = NEWGEN_CATALOG
export const VERIFIED_SURFACE_SUMMARY = NEWGEN_CATALOG.verifiedSurfaceSummary

export const run = options=>runCurrentPublications(options)

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
