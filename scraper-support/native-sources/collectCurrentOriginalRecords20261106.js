import {createCurrentNativeReader} from './boundedCurrentNativeRead20261106.js'
import {attachInventoryEvidence} from '../utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

export const canonicalNativeRecord=value=>JSON.stringify(value,(_,part)=>part&&typeof part==='object'&&!Array.isArray(part)?Object.fromEntries(Object.keys(part).sort().map(key=>[key,part[key]])):part)
export async function collectCurrentOriginalRecords(options,profile){
 options.signal?.throwIfAborted()
 const maxJobs=options.maxJobs??1000
 if(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>1000)throw RangeError('Invalid native output limit')
 const observedAt=(options.now??(()=>new Date().toISOString()))()
 if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw TypeError('Invalid native observation clock')
 const reader=createCurrentNativeReader(options,profile),holds=[]
 try{
  const opening=await profile.open(reader),records=opening.records,active=records.filter(profile.active),facts=[]
  for(const record of records){
   reader.check()
   if(!profile.active(record)){holds.push({nativeId:profile.id(record),reason:'native-unpublished-or-locked'});continue}
   const fact=profile.normalize(record,opening)
   if(!fact.sourceDetailComplete){holds.push({nativeId:profile.id(record),reason:fact.sourceDetailFailureKind});continue}
   facts.push({record,fact})
  }
  let closing=null,closingRecords=null,closingFailure=null
  try{closing=await profile.close(reader,opening,latest=>{closingRecords=latest.records});closingRecords=closing.records}catch(error){
   options.signal?.throwIfAborted();reader.check()
   if(error.nativeAuthorityFailure||!(error.name==='TimeoutError'||error.failureKind==='network_or_timeout'||[401,403,429,451].includes(error.status)||error.status>=500))throw error
   closingFailure={message:error.message,status:error.status??null,name:error.name,failureKind:error.failureKind??null}
  }
  const closedById=closingRecords?new Map(closingRecords.map(row=>[profile.id(row),row])):null
  const stable=facts.filter(({record})=>{
   if(!closedById)return true
   const latest=closedById.get(profile.id(record))
   if(latest&&profile.active(latest)&&canonicalNativeRecord(latest)===canonicalNativeRecord(record))return true
   holds.push({nativeId:profile.id(record),reason:'native-record-missing-unpublished-or-changed-at-closing'});return false
  })
  const permitted=stable.filter(({fact})=>fact.country===null||fact.country==='India')
  const jobs=permitted.slice(0,maxJobs).map(({fact})=>({...fact,source:profile.source,sourceOriginalCompanyName:profile.company,
   atsPlatform:profile.atsPlatform,companyCareerPage:profile.corporateURL,sourceCorporateURL:profile.corporateURL,
   link:fact.applyUrl,scrapedAt:observedAt,sourceClosingReconciled:Boolean(closing),lifecycleCleanupAllowed:false}))
  const stats=reader.stats(),evidence={source:profile.source,recordKind:profile.recordKind,observedRecordCount:records.length,observedVacancyCount:active.length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,closedOrLockedCount:records.length-active.length,
   incompleteCriteriaCount:holds.filter(row=>row.reason==='native-full-criteria-unavailable').length,
   unknownCountryCount:stable.filter(({fact})=>fact.country===null).length,observedIndiaCount:stable.filter(({fact})=>fact.country==='India').length,
   observedForeignCount:stable.filter(({fact})=>fact.country&&fact.country!=='India').length,returnedCount:jobs.length,outputLimited:permitted.length>maxJobs,
   openingClosingRecordsMatch:closingRecords?canonicalNativeRecord(records)===canonicalNativeRecord(closingRecords):null,
   closingReconciled:Boolean(closing),closingFailure,holds,originalOpeningRecords:records,originalClosingRecords:closingRecords,
   sourceContext:opening.context??null,observationTime:observedAt,activationVerified:false,lifecycleCleanupAllowed:false,reader:stats}
  attachSourceObservationEvidence(jobs,evidence)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.corporateURL,firstParty:true,listingComplete:false,pagesFetched:stats.requests,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:closingFailure?'closing-read-failed;company-scope-unqualified':'observed-native-records;company-scope-unqualified'})
  if(Buffer.byteLength(JSON.stringify({jobs,evidence}))>8*1024*1024)throw Error('Native output byte budget exceeded')
  reader.check();return jobs
 }finally{reader.close()}
}
