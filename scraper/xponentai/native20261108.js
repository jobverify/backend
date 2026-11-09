import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {PRIMARY,INDEX,FEED,primary,indexContract,collection,ownJSON,ownRole,roleURL,publication,need} from './data20261108.js'
import {settingsFor,runtime,bounded,annotateFailure,errorValue} from './runtime20261108.js'
import {nativeTransport} from './transport20261108.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const failures=new WeakMap(),sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export const readXponentFailureEvidence=signal=>{const value=failures.get(signal);return value?structuredClone(value):null}
export const createXponentNativeScraper=(defaults={})=>({run:async(options={})=>{
 const settings=settingsFor(defaults,options),control=runtime(settings),responses=[],observations=new Map()
 let currentReceipt=null,lastRead=-Infinity,phase='opening',opening=null,closing=null,observedAt=null,admissionAt=null,admissionSummary=null
 const clock=()=>{control.check();const value=new Date((settings.now??(()=>new Date()))());need(Number.isFinite(value.getTime()),'invalid observation clock');control.check();return value.toISOString()}
 const transport=nativeTransport({timeoutMs:settings.readTimeoutMs,fetchImpl:settings.fetchImpl,callerSignal:settings.signal,onReceipt:(packet,url)=>{
  if(!currentReceipt){currentReceipt={requestedURL:url,phase,response:packet};responses.push(currentReceipt)}
 }})
 const read=async(url,expectedMime='html')=>{
  control.check();const wait=lastRead+(settings.rateLimitMs??500)-performance.now()
  if(wait>0)await delay(wait,undefined,{signal:control.signal})
  control.check();control.admit();control.check();lastRead=performance.now();currentReceipt=null
  let result
  try{result=await transport(url,{signal:control.signal,expectedMime})}
  catch(error){settings.signal?.throwIfAborted();const status=currentReceipt?.response?.status;if(status&&status!==200&&errorValue(error,'status')===status)throw error;control.check();throw error}
  control.check();need(result.bodyComplete,'original entity incomplete');result.bodySHA256=sha(Buffer.from(result.rawBodyBase64,'base64'));control.check();return result
 }
 const nextPage=(header,page)=>{
  const matches=[...(header||'').matchAll(/<([^<>]+)>\s*;\s*rel="?next"?(?=\s*(?:,|$))/g)]
  need(matches.length<=1,'ambiguous native pagination handoff')
  if(!matches.length)return null
  const url=new URL(matches[0][1]),query=[...url.searchParams]
  need(url.origin==='https://xponent.ai'&&url.pathname==='/wp-json/wp/v2/awsm_job_openings'&&!url.username&&!url.password&&!url.hash&&query.length===1&&query[0][0]==='page'&&query[0][1]===String(page+1),'native pagination target changed or filtered')
  return url.href
 }
 const makeRow=(record,parsed,bodySHA256)=>({
  source:'xponentai',company:'xponent.ai',jobId:String(record.id),requisitionId:null,title:parsed.title,
  sourceUrl:record.link,link:record.link,detailUrl:record.link,applyUrl:null,activeApplyVerified:false,applicationVisited:false,
  jobDescription:parsed.description,sourceDescription:parsed.description,sourceNativeDescriptionHTML:parsed.descriptionHTML,
  sourceNativeRecord:structuredClone(record),sourceNativeSchema:parsed.schema,sourceNativeOwnBodySHA256:bodySHA256,
  sourceNativePublication:parsed.nativePublication,sourceNativePhase:phase,sourceNativeIdentityKind:'wordpress-published-job-post',
  country:parsed.country,location:parsed.location,city:parsed.city,state:parsed.state,workplaceType:parsed.workplaceType,remoteStatus:parsed.remoteStatus,
  sourceNativeCountryConflict:parsed.sourceNativeCountryConflict,sourceCountryScopeUnresolved:parsed.sourceCountryScopeUnresolved,sourceNativeCountryEvidence:parsed.sourceNativeCountryEvidence,
  sourceNativeWorkplaceConflict:parsed.sourceNativeWorkplaceConflict,sourceNativeWorkplaceEvidence:parsed.sourceNativeWorkplaceEvidence,
  postingDate:parsed.schema.datePosted,closingDate:record.meta.awsm_job_expiry||null,department:null,employmentType:parsed.schema.employmentType??null,
  experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],sourceDetailComplete:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  sourceCurrentNativePostingIdentityQualified:true,sourceCurrentNativeRoleQualified:false,sourceNativeActiveHiringVerified:false,sourceNativeIssues:[...parsed.nativePublication.issues],
  companyCareerPage:PRIMARY,companyDomain:'xponent.ai',atsPlatform:'wp-job-openings-native-own-html',scrapedAt:observedAt,
 })
 const collect=async()=>{
  const declaration=primary((await read(PRIMARY)).body);control.check()
  const contract=indexContract((await read(INDEX,'json')).body);control.check()
  let url=FEED,page=1,total=null,totalPages=null;const listings=[],ids=new Set(),pages=[]
  while(url){
   const response=await read(url,'json'),records=collection(response.body,record=>{
    // Retain each validated model before checking the next record or totals.
    control.check()
    need(!ids.has(record.id),'duplicate native identity across pages');ids.add(record.id);listings.push(record)
    const key=String(record.id)
    if(!observations.has(key))observations.set(key,{nativeId:key,listingRecord:structuredClone(record),nativeRecord:null,closingListingRecord:null,openingRow:null,closingRow:null,paired:false,issues:[]})
    else if(phase==='closing')observations.get(key).closingListingRecord=structuredClone(record)
   })
   control.check()
   const count=response.headers?.['x-wp-total'],number=response.headers?.['x-wp-totalpages']
   need(/^\d+$/.test(count||'')&&/^\d+$/.test(number||''),'native total or page count missing')
   if(total===null){total=Number(count);totalPages=Number(number)}else need(total===Number(count)&&totalPages===Number(number),'native pagination totals changed')
   need(total<=1000000&&totalPages===Math.ceil(total/contract.defaultPageSize)&&page<=Math.max(1,totalPages)&&records.length===Math.min(contract.defaultPageSize,Math.max(0,total-(page-1)*contract.defaultPageSize)),'native page length/total disagreement')
   pages.push({url,bodySHA256:response.bodySHA256,count:records.length})
   control.check();url=nextPage(response.headers.link,page)
   need(Boolean(url)===(page<totalPages),'native next-page declaration missing or exceeds total');page++
  }
  need(listings.length===total,'native collection truncated')
  for(const listing of listings){
   control.check();const own=await read(listing._links.self[0].href,'json'),native=ownJSON(own.body,listing),observation=observations.get(String(listing.id));control.check()
   if(phase==='opening')observation.nativeRecord=structuredClone(native)
   const response=await read(roleURL(native)),parsed=ownRole(response.body,native,clock()),row=makeRow(native,parsed,response.bodySHA256);control.check()
   if(phase==='opening')observation.openingRow=row
   else{observation.closingRow=row;observation.paired=Boolean(observation.openingRow)&&isDeepStrictEqual(observation.nativeRecord,native)&&observation.openingRow.sourceDescription===row.sourceDescription&&isDeepStrictEqual(observation.openingRow.sourceNativeSchema,row.sourceNativeSchema);if(!observation.paired)observation.issues.push('native-opening-closing-model-or-criteria-changed')}
  }
  return {phase,declaration,contract,totalNativePublishedPosts:total,pages,records:listings}
 }
 const snapshot=()=>({source:'xponentai',recordKind:'vacancy-rows',observedRecordCount:observations.size,observedVacancyCount:observations.size,observedAt,admissionAt,admissionSummary,opening,closing,observations:[...observations.values()],rawResponses:responses,
  ownNativeModels:[...observations.values()].filter(v=>v.nativeRecord).length,completeDescriptions:[...observations.values()].filter(v=>v.openingRow).length,pairedNativeModels:[...observations.values()].filter(v=>v.paired).length,
  companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  qualification:'All published native post models and complete own HTML criteria retained before selection. Unknown countries, active hiring, applications, complete company scope, persistence and public visibility remain unverified.'})
 try{
  observedAt=clock()
  opening=await collect();phase='closing';closing=await collect();control.check()
  const stable=isDeepStrictEqual(opening.records,closing.records)
  if(!stable)for(const observation of observations.values()){observation.paired=false;observation.issues.push('native-opening-closing-inventory-changed')}
  const all=[...observations.values()].filter(v=>v.openingRow).map(v=>{
   const row=structuredClone(v.openingRow);row.sourceNativeClosingRecord=structuredClone(v.closingRow?.sourceNativeRecord??null);row.sourceNativeModelPairQualified=v.paired
   row.sourceNativeClosingPublication=structuredClone(v.closingRow?.sourceNativePublication??null)
   row.sourceNativeIssues=[...new Set([...row.sourceNativeIssues,...v.closingRow?.sourceNativeIssues??[],...v.issues])];return row
  });control.check()
  const baseIssues=new Map(all.map(row=>[row.jobId,[...row.sourceNativeIssues]]))
  const audit=snapshot();Object.assign(audit,{nativeInventoryStable:stable,countryUnresolvedCount:all.filter(v=>v.country===null).length,observedIndiaCount:all.filter(v=>v.country==='India').length})
  const refresh=(guard=()=>control.check())=>{
   guard();admissionAt=clock()
   for(const row of all){
    guard();row.sourceNativeAdmissionAt=admissionAt;row.sourceNativeAdmissionPublication=publication(row.sourceNativeRecord,row.sourceNativeSchema,admissionAt)
    row.sourceNativeTemporalQualified=Boolean(row.sourceNativeModelPairQualified&&row.sourceNativePublication.qualified&&row.sourceNativeClosingPublication?.qualified&&row.sourceNativeAdmissionPublication.qualified)
    row.sourceCurrentNativeRoleQualified=row.sourceNativeTemporalQualified&&row.country!==null&&!row.sourceNativeCountryConflict&&!row.sourceNativeWorkplaceConflict
    row.sourceNativeIssues=[...new Set([...baseIssues.get(row.jobId),...row.sourceNativeAdmissionPublication.issues])]
   }
   guard();admissionSummary=all.map(row=>({jobId:row.jobId,at:admissionAt,temporalQualified:row.sourceNativeTemporalQualified,roleQualified:row.sourceCurrentNativeRoleQualified,publication:structuredClone(row.sourceNativeAdmissionPublication)}))
   guard();audit.admissionAt=admissionAt;audit.admissionSummary=structuredClone(admissionSummary);guard()
  }
  await bounded(async(signal,check)=>{
   const guard=()=>{control.check();check()}
   refresh(guard)
   if(settings.onAudit){guard();const detached=structuredClone(audit);guard();await settings.onAudit(detached,{signal},guard);guard();refresh(guard)}
   if(settings.onRecords){guard();const detached=structuredClone(all);guard();await settings.onRecords(detached,{signal},guard);guard();refresh(guard)}
  },{signal:control.signal,timeoutMs:settings.auditTimeoutMs,code:'XPONENT_AUDIT_TIMEOUT'});control.check()
  // Observer time cannot keep an expired post eligible for final admission.
  refresh()
  const selected=all.filter(row=>row.sourceNativeTemporalQualified&&(row.country===null||row.country==='India')),jobs=settings.maxJobs===null?selected:selected.slice(0,settings.maxJobs)
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:PRIMARY,firstParty:true,listingComplete:false,pagesFetched:control.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'complete-native-post-models-and-own-HTML-criteria;country-India-zero-company-hiring-application-and-publication-scope-unqualified'})
 }catch(error){const evidence=structuredClone(snapshot());if(settings.signal?.aborted){failures.set(settings.signal,evidence);throw settings.signal.reason}throw annotateFailure(error,{source:'xponentai',sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeEvidence:evidence})}
 finally{control.close()}
}})
