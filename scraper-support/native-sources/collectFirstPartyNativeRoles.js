import {createFirstPartyDocumentReader,firstPartyFailure} from './boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

// Current first-party role observations, with company scope deliberately open.
// Unknown countries remain observations; they never acquire an India default.
export async function collectFirstPartyNativeRoles(options,profile){
 const {source,company,configuredURL,currentURL=configuredURL,parseIndex,parseDetail,isRoleURL}=profile
 const failure=message=>firstPartyFailure(source,message),cap=options.maxJobs??null
 if(cap!==null&&(!Number.isSafeInteger(cap)||cap<1||cap>1000))throw RangeError('Invalid native role output limit')
 const reader=createFirstPartyDocumentReader(options,{source,urls:[configuredURL,currentURL],roleURL:isRoleURL,
  redirects:profile.redirectTarget?{[configuredURL]:profile.redirectTarget}:{}})
 try{
  const observedAt=(options.now??(()=>new Date().toISOString()))()
  if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw failure('Invalid native observation clock')
  const entry=await reader.read(configuredURL)
  if(profile.redirectTarget&&(entry.status!==301||entry.declaredTarget!==profile.redirectTarget))throw failure('Configured native canonical declaration changed')
  const opening=profile.redirectTarget?await reader.read(currentURL):entry
  const listings=parseIndex(opening.body);reader.check()
  if(!listings.length||listings.length>32)throw failure('Missing or excessive native role inventory')
  const facts=[],ids=new Set()
  for(const listing of listings){
   reader.allowRole(listing.sourceUrl)
   const detail=await reader.read(listing.sourceUrl),fact=parseDetail(detail.body,listing)
   reader.check()
   if(typeof fact.jobId!=='string'||!fact.jobId||ids.has(fact.jobId))throw failure('Duplicate or invalid native role identity')
   ids.add(fact.jobId);facts.push(fact)
  }
  for(const [index,fact] of facts.entries()){
   const detail=await reader.read(listings[index].sourceUrl),closed=parseDetail(detail.body,listings[index]);reader.check()
   if(JSON.stringify(closed)!==JSON.stringify(fact))throw failure('Closing native role criteria, state or identity changed')
  }
  const closing=await reader.read(currentURL)
  if(JSON.stringify(parseIndex(closing.body))!==JSON.stringify(listings))throw failure('Closing native listing cohort changed')
  const included=facts.filter(row=>row.country===null||row.country==='India')
  const selected=cap===null?included:included.slice(0,cap)
  const jobs=selected.map(row=>({...row,source,company,link:row.applyUrl,scrapedAt:observedAt,companyCareerPage:configuredURL,
   companyDomain:profile.companyDomain,atsPlatform:profile.atsPlatform}))
  const summary={source,observedRecordCount:listings.length,observedVacancyCount:listings.length,inspectedNativeDetails:facts.length,
   nativeIndiaCountryMatches:facts.filter(row=>row.country==='India').length,unknownCountryCount:facts.filter(row=>row.country===null).length,
   explicitNonIndiaCount:facts.filter(row=>row.country&&row.country!=='India').length,sourceExplicitOutputLimit:cap,returnedRows:jobs.length,
   nativeOpeningClosingRecordsMatch:true,nativeOpeningClosingCriteriaMatch:true,observedNativeRoleRecords:facts,
   companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationActivationVerified:false,...reader.stats()}
  if(jobs.length)jobs[0].nativeCollectionEvidence=summary
  attachSourceObservationEvidence(jobs,{source,recordKind:'vacancy-rows',observedRecordCount:listings.length,observedVacancyCount:listings.length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:summary,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:currentURL,firstParty:true,listingComplete:false,pagesFetched:summary.requests,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'Complete observed native role criteria and closing facts;company scope, unknown workplace countries, application activation and cleanup remain unqualified'})
  if(Buffer.byteLength(JSON.stringify(jobs))>8*1024*1024)throw failure('Native output byte budget exceeded')
  reader.check();return jobs
 }catch(error){if(options.signal?.aborted)throw options.signal.reason;throw error}
 finally{reader.close()}
}
