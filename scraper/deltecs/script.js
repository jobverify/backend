import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadConfig} from '../../scraper-support/utils/loadConfig.js'
import {DELTECS_CATALOG} from './catalog.js'
import {createFirstPartyDocumentReader,firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {parseCurrentHomepage,hasCurrentHomepageSignal,extractCurrentListings,extractCurrentDetail,isCurrentRoleURL,listingSnapshot} from './currentNative.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url)),config=loadConfig(currentDir)
export const PROVIDER_METADATA=DELTECS_CATALOG,SOURCE=DELTECS_CATALOG.source,COMPANY=DELTECS_CATALOG.companyName,
 OFFICIAL_BRAND_NAME=DELTECS_CATALOG.officialBrandName,PUBLIC_BRAND_NAME=DELTECS_CATALOG.publicBrandName,
 VERIFIED_AT=DELTECS_CATALOG.verifiedOn,VERIFIED_SURFACE_SUMMARY=DELTECS_CATALOG.verifiedSurfaceSummary,
 HOMEPAGE_URL=DELTECS_CATALOG.homepageUrl,CAREERS_URL=DELTECS_CATALOG.companyCareerPage
export const hasOfficialHomepageSignal=hasCurrentHomepageSignal
export const hasOfficialCareersPageSignal=html=>{try{return extractCurrentListings(html).length>0}catch{return false}}
export const extractListings=extractCurrentListings,extractJobDetail=extractCurrentDetail
export const hasOfficialJobDetailSignal=(html,listing)=>{try{extractCurrentDetail(html,listing);return true}catch{return false}}
export const createDeltecsScraper=(factoryOptions={})=>({
 async run(runOptions={}){
  const options={...factoryOptions,...runOptions},maxJobs=options.maxJobs??(Number.isInteger(config.maxJobs)&&config.maxJobs>0?config.maxJobs:null)
  if(maxJobs!==null&&(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>1000))throw RangeError('Invalid DronaHQ output limit')
  const reader=createFirstPartyDocumentReader(options,{source:SOURCE,urls:[HOMEPAGE_URL,CAREERS_URL],roleURL:isCurrentRoleURL})
  try{
   const observedAt=(options.now??(()=>new Date().toISOString()))()
   if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw firstPartyFailure(SOURCE,'Invalid source clock')
   const home=await reader.read(HOMEPAGE_URL),employer=parseCurrentHomepage(home.body)
   const opening=await reader.read(CAREERS_URL),rows=extractCurrentListings(opening.body)
   rows.forEach(row=>reader.allowRole(row.sourceUrl))
   const facts=[],postIds=new Set()
   for(const row of rows){
    reader.check()
    if(maxJobs!==null&&facts.filter(job=>job.country==='India').length>=maxJobs)break
    const detail=await reader.read(row.sourceUrl)
    const fact=extractCurrentDetail(detail.body,row)
    if(postIds.has(fact.jobId))throw firstPartyFailure(SOURCE,'Duplicate native published post identity reused by distinct listed URLs')
    postIds.add(fact.jobId);facts.push(fact)
   }
   for(const fact of facts){
    const row=rows.find(row=>row.sourceUrl===fact.sourceUrl),closingDetail=await reader.read(fact.sourceUrl)
    if(JSON.stringify(extractCurrentDetail(closingDetail.body,row))!==JSON.stringify(fact))throw firstPartyFailure(SOURCE,'Closing native role criteria or identity changed')
   }
   const closing=await reader.read(CAREERS_URL)
   if(listingSnapshot(extractCurrentListings(closing.body))!==listingSnapshot(rows))throw firstPartyFailure(SOURCE,'Closing native vacancy cohort changed')
   const closingHome=await reader.read(HOMEPAGE_URL)
   if(JSON.stringify(parseCurrentHomepage(closingHome.body))!==JSON.stringify(employer))throw firstPartyFailure(SOURCE,'Closing native employer identity changed')
   const jobs=facts.filter(job=>job.country==='India').map(job=>({...job,source:SOURCE,company:COMPANY,link:job.applyUrl,scrapedAt:observedAt,
    companyCareerPage:CAREERS_URL,companyDomain:DELTECS_CATALOG.companyDomain,atsPlatform:DELTECS_CATALOG.atsPlatform}))
   const summary={source:SOURCE,observedRecordCount:rows.length,observedVacancyCount:rows.length,observedNativeListingRecords:rows,
    inspectedNativeDetails:facts.length,returnedRows:jobs.length,unknownCountryCount:facts.filter(job=>job.country===null).length,
    nativeIndiaCountryMatches:facts.filter(job=>job.country==='India').length,sourceExplicitLimit:maxJobs,
    nativeOpeningClosingRecordsMatch:true,nativeOpeningClosingCriteriaMatch:true,nativeOpeningClosingEmployerMatch:true,
    companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationActivationVerified:false,...reader.stats()}
   if(jobs.length)jobs[0].nativeCollectionEvidence=summary
   attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,
    sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
   Object.defineProperty(jobs,'nativeCollectionEvidence',{value:summary,configurable:true})
   attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:summary.requests,
    reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
    reason:'current-native-role-criteria-explicit-workplace-country-and-employer-binding;company-scope-dates-and-application-activation-unverified;cleanup-forbidden'})
   if(Buffer.byteLength(JSON.stringify(jobs))>8*1024*1024)throw firstPartyFailure(SOURCE,'Native output byte budget exceeded')
   reader.check();return jobs
  }catch(error){if(options.signal?.aborted)throw options.signal.reason;throw error}
  finally{reader.close()}
 }
})
export const run=options=>createDeltecsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
