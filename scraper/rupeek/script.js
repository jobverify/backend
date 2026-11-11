import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runNative,extractJobCardsFromCareersHtml,hasOfficialRupeekCareersSignals} from './native20261111.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import RUPEEK_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = RUPEEK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const OFFICIAL_CAREERS_CANONICAL_URL = PROVIDER_METADATA.officialCareersCanonicalUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export {extractJobCardsFromCareersHtml,hasOfficialRupeekCareersSignals}
export const createRupeekScraper=(defaults={})=>({run:(options={})=>runNative({...defaults,...options})})
export const run=(options={})=>createRupeekScraper({maxJobs:config.maxJobs??20}).run(options)

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
