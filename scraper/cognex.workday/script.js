import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readFileSync } from 'node:fs'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "cognex"
export const COMPANY = "Cognex"
export const CAREERS_URL = "https://www.cognex.com/en/company/careers"
export const DISPOSITION = "guarded-workday-native"
export const VERIFIED_ON = "2026-08-08"
export const VERIFIED_SURFACE_SUMMARY = "Guarded native Workday observations require a current exact corporate handoff and reconciled unfiltered board country proof. Historical catalog dates do not authorize current inventory or company completeness."

// This exact profile is mandatory before IO. loadConfig otherwise silently
// falls back to central defaults when a local file is missing or malformed.
const REQUIRED_PROFILE = Object.freeze({
  "listingStrategy": "jobs-api",
  "inventoryScope": "complete-board-country-proof",
  "officialCareersUrl": "https://www.cognex.com/en/company/careers",
  "jobsApiUrl": "https://cognex.wd1.myworkdayjobs.com/wday/cxs/cognex/External_Career_Site/jobs",
  "detailUrlBase": "https://cognex.wd1.myworkdayjobs.com/External_Career_Site",
  "locationCountry": null,
  "searchText": ""
})

const assertNativeProfile = signal => {
  signal?.throwIfAborted()
  try {
    const profile = JSON.parse(readFileSync(path.join(currentDir, 'config.json'), 'utf8'))
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)
      || Object.keys(profile).length !== Object.keys(REQUIRED_PROFILE).length
      || Object.entries(REQUIRED_PROFILE).some(([key, value]) => !Object.hasOwn(profile, key) || profile[key] !== value)) {
      throw new Error('The declared native Workday profile does not match this source')
    }
  } catch (cause) {
    signal?.throwIfAborted()
    const error = new Error(`[${SOURCE}] Missing, malformed or mismatched native Workday profile`, { cause })
    error.code = 'WORKDAY_SOURCE_CONFIG_INVALID'
    error.abortRetries = true
    error.partial = true
    error.sourceScopeComplete = false
    error.sourceListingComplete = false
    error.lifecycleCleanupAllowed = false
    throw error
  }
  signal?.throwIfAborted()
}

export const run = async (options = {}) => {
  assertNativeProfile(options.signal)
  return runWorkdayScraper({
    ...options,
    company: COMPANY,
    source: SOURCE,
    baseUrl: REQUIRED_PROFILE.detailUrlBase,
    scraperDir: currentDir,
    locationCountry: null,
  })
}

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
