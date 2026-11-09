import path from 'node:path'
import {fileURLToPath} from 'node:url'
import CATALOG from './catalog.js'
import {createFirstPartyDocumentReader,firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CURRENT_CAREERS_URL,LEGACY_CAREERS_URL,extractCurrentOpenings,hasCurrentCareersSignal,currentSnapshot} from './currentNative.js'
export const SOURCE=CATALOG.source,COMPANY=CATALOG.companyName,CAREERS_URL=CATALOG.companyCareerPage,VERIFIED_ON=CATALOG.verifiedOn
export {CURRENT_CAREERS_URL}
export const hasOfficialCareersSignal=hasCurrentCareersSignal
export const extractOpeningCards=extractCurrentOpenings
export const extractPaginationUrls=()=>[]
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const createCodewaveTechnologiesScraper=(factoryOptions={})=>({
 async run(runOptions={}){
  const options={...factoryOptions,...runOptions},maxJobs=options.maxJobs??null
  if(maxJobs!==null&&(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>1000))throw RangeError('Invalid Codewave output limit')
  const reader=createFirstPartyDocumentReader(options,{source:SOURCE,urls:[LEGACY_CAREERS_URL,CURRENT_CAREERS_URL],redirects:{[LEGACY_CAREERS_URL]:CURRENT_CAREERS_URL}})
  try{
   const observedAt=(options.now??(()=>new Date().toISOString()))()
   if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw firstPartyFailure(SOURCE,'Invalid source clock')
   const declaration=await reader.read(CAREERS_URL)
   if(declaration.status!==301||declaration.declaredTarget!==CURRENT_CAREERS_URL)throw firstPartyFailure(SOURCE,'Configured careers canonical declaration changed')
   const opening=await reader.read(CURRENT_CAREERS_URL),rows=extractCurrentOpenings(opening.body,{check:reader.check})
   const india=rows.filter(row=>row.country==='India'),selected=maxJobs===null?india:india.slice(0,maxJobs)
   const closing=await reader.read(CURRENT_CAREERS_URL),final=extractCurrentOpenings(closing.body,{check:reader.check})
   if(currentSnapshot(rows)!==currentSnapshot(final))throw firstPartyFailure(SOURCE,'Closing native careers cohort changed')
   const jobs=selected.map(row=>({...row,source:SOURCE,company:COMPANY,link:row.applyUrl,scrapedAt:observedAt,
    companyCareerPage:CAREERS_URL,companyDomain:CATALOG.companyDomain,atsPlatform:CATALOG.atsPlatform}))
   const summary={source:SOURCE,observedRecordCount:rows.length,observedVacancyCount:rows.length,nativeIndiaCountryMatches:india.length,
    unknownCountryCount:rows.filter(row=>row.country===null).length,explicitNonIndiaCount:rows.filter(row=>row.country&&row.country!=='India').length,
    sourceExplicitLimit:maxJobs,returnedRows:jobs.length,nativeOpeningClosingRecordsMatch:true,nativeOpeningClosingCriteriaMatch:true,
    companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    applicationActivationVerified:false,observedNativeRoleRecords:rows,...reader.stats()}
   if(jobs.length)jobs[0].nativeCollectionEvidence=summary
   attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,
    sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
   Object.defineProperty(jobs,'nativeCollectionEvidence',{value:summary,configurable:true})
   attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CURRENT_CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:summary.requests,
    reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
    reason:'current-native-expandable-role-criteria-and-explicit-workplace-countries;company-scope-dates-and-application-activation-unverified;cleanup-forbidden'})
   if(Buffer.byteLength(JSON.stringify(jobs))>8*1024*1024)throw firstPartyFailure(SOURCE,'Native output byte budget exceeded')
   reader.check();return jobs
  }catch(error){if(options.signal?.aborted)throw options.signal.reason;throw error}
  finally{reader.close()}
 }
})
export const run=options=>createCodewaveTechnologiesScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
