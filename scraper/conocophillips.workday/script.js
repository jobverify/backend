import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readFileSync } from 'node:fs'

import {runVerifiedWorkdayBoardUnion} from '../../scraper-support/shared/workdayBoardUnion.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "conocophillips"
export const COMPANY = "ConocoPhillips"
export const CAREERS_URL = "https://careers.conocophillips.com/"
export const DISPOSITION = "guarded-workday-native"
export const VERIFIED_ON = "2026-08-01"
export const VERIFIED_SURFACE_SUMMARY = "Guarded native Workday observations require a current exact corporate handoff and reconciled unfiltered board country proof. Historical catalog dates do not authorize current inventory or company completeness."

// This exact profile is mandatory before IO. loadConfig otherwise silently
// falls back to central defaults when a local file is missing or malformed.
const REQUIRED_PROFILE = Object.freeze({
  "listingStrategy": "jobs-api",
  "inventoryScope": "complete-board-country-proof",
  "retainProvenIndiaOnUnresolvedLocations": true,
  "officialCareersUrl": "https://careers.conocophillips.com/",
  "jobsApiUrl": "https://conocophillips.wd1.myworkdayjobs.com/wday/cxs/conocophillips/External/jobs",
  "detailUrlBase": "https://conocophillips.wd1.myworkdayjobs.com/External/",
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
  options.signal?.throwIfAborted()
  if(options.maxJobs===0)return attachInventoryEvidence([],{status:'coverage-gap',surface:CAREERS_URL,firstParty:false,
    listingComplete:false,pagesFetched:0,reason:'caller-cap-zero-no-public-reads'})
  assertNativeProfile(options.signal)
  return runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,
    boards:[{tenant:'conocophillips',site:'External',baseUrl:REQUIRED_PROFILE.detailUrlBase,scraperDir:currentDir}],
    employerPattern:/\bConocoPhillips\b/i,requireEmployer:true,completeSourceScope:false,allowUnresolvedCountryScope:true,
    scopeReason:'current-published-board-reconciled;uncertain-worksite-countries-remain-unresolved;company-scope-incomplete',
  },{...options,nativeDetailRecovery:false,retainNativeProof:true})
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
