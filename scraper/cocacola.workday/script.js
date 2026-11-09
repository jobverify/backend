import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readFileSync } from 'node:fs'

import {runVerifiedWorkdayBoardUnion} from '../../scraper-support/shared/workdayBoardUnion.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "cocacola"
export const COMPANY = "Coca-Cola"
export const CAREERS_URL = "https://www.coca-colacompany.com/careers"
export const DISPOSITION = "guarded-workday-native"
export const VERIFIED_ON = "2026-08-01"
export const VERIFIED_SURFACE_SUMMARY = "Guarded native Workday observations require a current exact corporate handoff and reconciled unfiltered board country proof. Historical catalog dates do not authorize current inventory or company completeness."

// This exact profile is mandatory before IO. loadConfig otherwise silently
// falls back to central defaults when a local file is missing or malformed.
const REQUIRED_PROFILE = Object.freeze({
  "listingStrategy": "jobs-api",
  "inventoryScope": "complete-board-country-proof",
  "retainProvenIndiaOnUnresolvedLocations": true,
  "officialCareersUrl": "https://www.coca-colacompany.com/careers",
  "officialVanityCareersUrl": "https://careers.coca-colacompany.com/",
  "officialVanityRedirectStatus": 301,
  "jobsApiUrl": "https://coke.wd1.myworkdayjobs.com/wday/cxs/coke/coca-cola-careers/jobs",
  "detailUrlBase": "https://coke.wd1.myworkdayjobs.com/coca-cola-careers",
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
  const jobs=await runVerifiedWorkdayBoardUnion({source:SOURCE,company:COMPANY,
    boards:[{tenant:'coke',site:'coca-cola-careers',baseUrl:REQUIRED_PROFILE.detailUrlBase,scraperDir:currentDir}],
    employerPattern:/^(?:1158 Coca-Cola India Private Limited|1940 International Refreshments \(India\) Private Limited|1251 Coca-Cola Beverages \(Shanghai\) Company Limited|1648 Coca-Cola Far East Limited - Philippines Branch)$/,
    requireEmployer:true,completeSourceScope:false,allowUnresolvedCountryScope:true,
    scopeReason:'complete-published-board-reconciled;explicit-native-India-worksites-only;unresolved-location-and-company-scope-incomplete',
  },{...options,nativeDetailRecovery:false,retainNativeProof:true})
  for(const job of jobs){
    const info=job.nativeSourceRecord.jobPostingInfo
    const india=[]
    if(info.country?.descriptor==='India'&&info.country.id==='c4f78be1a8f14da0ab49ce1162348a5e')india.push(info.location)
    for(const label of info.additionalLocations||[])if(typeof label==='string'&&(/^(?:India)\s+-\s+\S/.test(label)||/,\s*India$/.test(label)))india.push(label)
    if(!india.length)throw Error('Coca-Cola native India worksite is missing; company and city defaults are forbidden')
    Object.assign(job,{locations:[...new Set(india)],location:[...new Set(india)].join(' / '),city:null,
      nativeLocationEvidence:{primaryCountry:structuredClone(info.country),primaryLocation:info.location,
        requisitionLocation:structuredClone(info.jobRequisitionLocation),secondaryLocations:structuredClone(info.additionalLocations||[])},
      nativeLegalEmployer:job.nativeSourceRecord.hiringOrganization.name,
      employmentType:typeof info.timeType==='string'&&info.timeType.trim()?info.timeType:null,
      remoteStatus:typeof info.remoteType==='string'&&info.remoteType.trim()?info.remoteType:null,
      sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false})
  }
  return jobs
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
