import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readFileSync } from 'node:fs'

import { runCondeNastNative,collectCondeNastNative } from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "condenast"
export const COMPANY = "Conde Nast"
export const CAREERS_URL = "https://www.condenast.com/careers"
export const DISPOSITION = "current-publisher-bound-native-India-country-facet-partial-company-scope"
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = "Current declared country-card renderer, explicit India native countries, exact hiring organizations, full original role models and closing reconciliation. Company scope and lifecycle cleanup remain unqualified."

// This exact profile is mandatory before IO. loadConfig otherwise silently
// falls back to central defaults when a local file is missing or malformed.
const REQUIRED_PROFILE = Object.freeze({
  "listingStrategy": "jobs-api",
  "inventoryScope": "published-india-country-facet-with-paired-native-roles",
  "officialCareersUrl": "https://www.condenast.com/careers",
  "jobsApiUrl": "https://condenast.wd115.myworkdayjobs.com/wday/cxs/condenast/CondeCareers/jobs",
  "detailUrlBase": "https://condenast.wd115.myworkdayjobs.com/CondeCareers",
  "locationCountry": "c4f78be1a8f14da0ab49ce1162348a5e",
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
  return runCondeNastNative(options)
}
export const inspectInventory = async (options={}) => { assertNativeProfile(options.signal); return collectCondeNastNative(options) }

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
