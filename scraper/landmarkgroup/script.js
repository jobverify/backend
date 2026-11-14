import { buildOracleSearchUrl, buildOracleJobUrl, createOracleNativeScraper, extractOracleDiscovery } from '../arcelormittal/oracleNative.js'
import { readOracleNativeReport } from '../arcelormittal/oracleNative.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
export const LISTING_API_BASE_URL = 'https://efhi.fa.em3.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const PUBLIC_JOBS_BASE_URL = 'https://efhi.fa.em3.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/'
export const SITE_NUMBER = 'CX_1'
export const DEFAULT_LOCATION = null
export const DEFAULT_LIMIT = 24
export const buildSearchUrl = options => buildOracleSearchUrl('landmarkgroup', options)
export const buildJobDetailUrl = id => buildOracleJobUrl('landmarkgroup', id)
export const extractSearchResults = payload => extractOracleDiscovery('landmarkgroup', payload)
const exposeNativeReport = jobs => {
 const report=readOracleNativeReport(jobs)
 if(!report)return jobs
 const audit={...report,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null}
 if(report.sourceScopeComplete===false){
  const observed=report.oracle.observedCount+(report.otherScopeReport?.observedCount??0)
  Object.assign(audit,{recordKind:'vacancy-rows',observedRecordCount:observed,observedVacancyCount:observed})
  attachSourceObservationEvidence(jobs,audit)
 }
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 for(const job of jobs)job.lifecycleCleanupAllowed=false
 const inventory=readInventoryEvidence(jobs)
 if(inventory)attachInventoryEvidence(jobs,{...inventory,lifecycleCleanupAllowed:false})
 return jobs
}
export const createLandmarkGroupScraper = options => {
 const scraper=createOracleNativeScraper('landmarkgroup',options)
 return {...scraper,run:async runOptions=>exposeNativeReport(await scraper.run(runOptions))}
}
export const run = options => createLandmarkGroupScraper().run(options)
