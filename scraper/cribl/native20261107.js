import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {settingsFor,runtime,bounded,annotateFailure,errorValue} from './runtime20261107.js'
import {nativeTransport} from './transport20261107.js'
import {PROFILE,primaryDeclaration,reviewedAsset,nativeCollection,ownRole,roleURL,geography,publicationState,sha256,requireNative} from './data20261107.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const failureEvidence=new WeakMap()
export const readCriblFailureEvidence=signal=>{const value=failureEvidence.get(signal);return value?structuredClone(value):null}
const dateString=value=>{const date=new Date(value);requireNative(Number.isFinite(date.getTime()),'invalid observation clock');return date.toISOString()}
export const createCriblScraper=(defaults={})=>({run:async(options={})=>{
 const settings=settingsFor(defaults,options),control=runtime(settings),receipts=[],observations=new Map(),lastHostRead=new Map()
 let phase='opening',activeReceipt=null,opening=null,closing=null,observedAt=null
 const transport=nativeTransport({timeoutMs:settings.readTimeoutMs,fetchImpl:settings.fetchImpl,callerSignal:settings.signal,onReceipt:(packet,url)=>{
  if(!activeReceipt){activeReceipt={requestedURL:url,phase,response:packet};receipts.push(activeReceipt)}
 }})
 const read=async(url,mime='html',{allowRoleRedirect=false}={})=>{
  control.check()
  const host=new URL(url).host,wait=(lastHostRead.get(host)??-Infinity)+(settings.rateLimitMs??500)-performance.now()
  if(wait>0)await delay(wait,undefined,{signal:control.signal})
  control.check();control.admit();control.check();lastHostRead.set(host,performance.now());activeReceipt=null
  let packet
  try{packet=await transport(url,{signal:control.signal,expectedMime:mime})}
  catch(error){
   settings.signal?.throwIfAborted();const receipt=activeReceipt?.response
   // Headers already establish an HTTP failure even if body acquisition or
   // the aggregate budget expires afterwards. Never replace it with a race.
   if(receipt&&receipt.status!==200&&receipt.status!==308&&errorValue(error,'status')===receipt.status)throw error
   control.check()
   if(allowRoleRedirect&&receipt?.status===308&&receipt.url===url&&receipt.bodyComplete&&[url+'/',new URL(url).pathname+'/'].includes(receipt.headers?.location))packet=receipt
   else throw error
  }
  control.check();requireNative(packet.bodyComplete,'original response incomplete')
  const raw=Buffer.from(packet.rawBodyBase64,'base64');packet.bodySHA256=sha256(raw)
  control.check();return {packet,raw}
 }
 const own=async listing=>{
  const url=roleURL(listing.id),first=await read(url,'html',{allowRoleRedirect:true})
  requireNative(first.packet.status===308,'current own route no longer declares reviewed canonical handoff')
  const canonical=await read(url+'/')
  const parsed=ownRole(canonical.packet.body,listing);control.check()
  return {...parsed,url:url+'/',bodySHA256:canonical.packet.bodySHA256}
 }
 const rowFor=(listing,parsed)=>{
  const geo=geography(listing.location.name),publication=publicationState(listing,observedAt)
  return {
  source:'cribl',jobId:String(listing.id),title:listing.title,company:listing.company_name,internalJobId:listing.internal_job_id??null,requisitionId:listing.requisition_id??null,
  sourceUrl:parsed.url,link:parsed.url,detailUrl:parsed.url,applyUrl:null,activeApplyVerified:false,applicationVisited:false,
  ...parsed.full,sourceDescription:parsed.full.jobDescription,sourceNativeContent:listing.content,descriptionComplete:true,
  ...geo,postedDate:listing.first_published,updatedDate:listing.updated_at,closingDate:listing.application_deadline??null,
  companyCareerPage:PROFILE.primaryURL,companyDomain:'cribl.io',atsPlatform:'cribl-native-greenhouse-rsc',scrapedAt:observedAt,
  sourceNativeRecord:structuredClone(parsed.model),sourceNativeListingRecord:structuredClone(listing),sourceNativeOwnBodySHA256:parsed.bodySHA256,
  sourceNativeFlight:parsed.flight,sourceNativeLegacyListingURL:listing.absolute_url,sourceNativePhase:phase,
  sourceNativePublicationQualification:'employer-declared-public-native-post-and-own-route;active-hiring-and-application-unverified',
  sourceCurrentNativePostingIdentityQualified:true,sourceCurrentNativeRoleQualified:false,
  sourceNativePublicationQualified:publication.qualified,sourceNativeIssues:[...publication.issues,...geo.sourceNativeCountryConflict?['conflicting-native-role-countries']:[]],
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,
 }}
 const collect=async()=>{
  const primary=await read(PROFILE.primaryURL);const declaration=primaryDeclaration(primary.packet.body);control.check()
  const asset=await read(PROFILE.assetURL,'gzip-script');const contract=reviewedAsset(asset.raw);control.check()
  const feed=await read(PROFILE.feedURL,'json'),collection=nativeCollection(feed.packet.body);control.check()
  // Preserve the complete listing model before own-route reads or filtering.
  for(const listing of collection.jobs){
   const key=String(listing.id),earlier=observations.get(key)
   if(!earlier)observations.set(key,{nativeId:key,nativeRecord:null,listingRecord:structuredClone(listing),closingListingRecord:null,openingRow:null,closingRow:null,paired:false,issues:[]})
   else earlier.closingListingRecord=structuredClone(listing)
  }
  for(const listing of collection.jobs){
   control.check();const parsed=await own(listing),row=rowFor(listing,parsed),observation=observations.get(String(listing.id))
   if(phase==='opening'){observation.nativeRecord=structuredClone(parsed.model);observation.openingRow=row}
   else{
    observation.closingRow=row
    observation.paired=Boolean(observation.openingRow)&&isDeepStrictEqual(observation.nativeRecord,parsed.model)
    if(!observation.paired)observation.issues.push('native-model-changed-or-not-present-in-both-phases')
   }
   control.check()
  }
  return {phase,declaration,contract,listingCount:collection.jobs.length,ids:collection.jobs.map(job=>String(job.id)),originalFeedSHA256:feed.packet.bodySHA256,collection}
 }
 const snapshot=()=>{
  const rows=[...observations.values()],complete=rows.filter(v=>v.openingRow),countries=complete.map(v=>v.openingRow.country)
  return {source:'cribl',recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,
   observedAt,opening,closing,observations:rows,rawResponses:receipts,
   ownNativeModels:complete.length,pairedNativeModels:rows.filter(v=>v.paired).length,
   knownForeignCount:countries.filter(v=>v&&v!=='India').length,countryUnresolvedCount:countries.filter(v=>v===null).length,observedIndiaCount:countries.filter(v=>v==='India').length,
   companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   qualification:'Complete published native records; unknown countries, wider employer inventory, actual vacancies, applications, persistence and public visibility remain unverified.'}
 }
 try{
  observedAt=dateString((settings.now??(()=>new Date()))());control.check()
  opening=await collect();phase='closing';closing=await collect();control.check()
  const inventoryStable=isDeepStrictEqual(opening.collection,closing.collection)
  if(!inventoryStable)for(const observation of observations.values()){observation.paired=false;observation.issues.push('opening-closing-native-inventory-changed')}
  const all=[...observations.values()].filter(v=>v.openingRow).map(v=>{
   const row=structuredClone(v.openingRow)
   row.sourceNativeClosingRecord=structuredClone(v.closingRow?.sourceNativeRecord??null)
   row.sourceNativeModelPairQualified=v.paired
   row.sourceNativeTemporalQualified=v.paired&&row.sourceNativePublicationQualified&&v.closingRow.sourceNativePublicationQualified
   row.sourceCurrentNativeRoleQualified=row.sourceNativeTemporalQualified&&row.country!==null&&!row.sourceNativeCountryConflict
   row.sourceNativeIssues=[...new Set([...row.sourceNativeIssues,...v.closingRow?.sourceNativeIssues??[],...v.issues])]
   return row
  });control.check()
  const audit=snapshot();audit.nativeInventoryStable=inventoryStable
  const selected=all.filter(row=>row.sourceNativeTemporalQualified&&(row.country===null||row.country==='India'))
  const jobs=settings.maxJobs===null?selected:selected.slice(0,settings.maxJobs)
  // A single combined observer budget includes both owned clones and callbacks.
  await bounded(async(signal,check)=>{
   const guard=()=>{control.check();check()}
   if(settings.onAudit){guard();const detached=structuredClone(audit);guard();await settings.onAudit(detached,{signal},guard);guard()}
   if(settings.onRecords){guard();const detached=structuredClone(all);guard();await settings.onRecords(detached,{signal},guard);guard()}
  },{signal:control.signal,timeoutMs:settings.auditTimeoutMs,code:'CRIBL_AUDIT_TIMEOUT'});control.check()
  attachSourceObservationEvidence(jobs,audit)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:PROFILE.primaryURL,firstParty:true,listingComplete:false,pagesFetched:control.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
   reason:'native-role-models-extracted;unresolved-native-country-and-whole-company-scope;no-authoritative-India-zero'})
  return jobs
 }catch(error){
  const evidence=structuredClone(snapshot())
  if(settings.signal?.aborted){failureEvidence.set(settings.signal,evidence);throw settings.signal.reason}
  throw annotateFailure(error,{source:'cribl',sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeEvidence:evidence})
 }finally{control.close()}
}})
