import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {createNativeGreenhouseScraper,nativeEnvelopeFailed} from '../../scraper-support/native-sources/declaredGreenhouse/nativeCareers.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {buildHttpError} from '../../scraper-support/utils/fetch.js'
import {PROFILE,PRIMARY,EMBED,BOARD,API,API_FIELDS,POST_FIELDS,need,strictJSON,primary,embed,board,own,ownURL,publication,roleEvidence,applicationOnlyFields} from './data20261108.js'
import {settingsFor,runtime,bounded,combineNativeSignals,annotateFailure,errorValue} from './runtime20261108.js'
import {nativeTransport} from './transport20261108.js'
const failures=new WeakMap(),sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export const readDoximityFailureEvidence=signal=>{const value=failures.get(signal);return value?structuredClone(value):null}
export const createDoximityNativeScraper=(defaults={})=>({run:async(options={})=>{
 const settings=settingsFor(defaults,options),control=runtime(settings),acquisition=new AbortController(),responses=[],entries=new Map(),apiOriginalModels=new Map(),apiListingHistory=[],activeReads=new Set()
 let opening=null,closing=null,apiAudit=null,rows=[],stopped=null,nextStart=-Infinity,phase='opening',apiPhaseCount=0,apiPhase='api-opening',observedAt=null,admissionAt=null
 const clock=()=>{control.check();const value=new Date((settings.now??(()=>new Date()))());need(Number.isFinite(value.getTime()),'invalid observation clock');control.check();return value.toISOString()}
 const originalFetch=settings.fetchPage?async(url,init)=>{
  const value=await settings.fetchPage(url,init);need(value&&typeof value.bodyBase64==='string'&&typeof value.url==='string'&&Number.isInteger(value.status)&&value.headers,'original supplied page has no raw HTTP provenance')
  const bytes=Buffer.from(value.bodyBase64,'base64');need(bytes.toString('base64')===value.bodyBase64,'invalid original base64 entity');if(value.html!==undefined)need(value.html===bytes.toString('utf8'),'supplied decoded text contradicts original bytes')
  const response=new Response(bytes,{status:value.status,headers:value.headers});Object.defineProperty(response,'url',{value:value.url});return response
 }:settings.fetchImpl??globalThis.fetch
 const read=(url,mime='html',readPhase=phase)=>{
  const pending=(async()=>{
   let receipt=null
   try{
    control.check();if(stopped)throw stopped
    const at=Math.max(performance.now(),nextStart);nextStart=at+(settings.rateLimitMs??500);const wait=at-performance.now();if(wait>0)await delay(wait,undefined,{signal:control.signal})
    control.check();if(stopped)throw stopped;control.admit();control.check()
    const transport=nativeTransport({timeoutMs:settings.readTimeoutMs,fetchImpl:originalFetch,callerSignal:settings.signal,onReceipt:(packet)=>{
     if(!receipt){receipt={requestedURL:url,phase:readPhase,response:packet};responses.push(receipt)}
     if(packet.status&&packet.status!==200&&packet.headers&&!stopped){stopped=buildHttpError({status:packet.status,headers:new Headers(packet.headers)},url);Object.assign(stopped,{requestUrl:url,abortRetries:true})}
    }})
    const result=await transport(url,{signal:combineNativeSignals([control.signal,acquisition.signal]),expectedMime:mime});control.check();need(result.bodyComplete,'incomplete native HTTP entity');result.bodySHA256=sha(Buffer.from(result.rawBodyBase64,'base64'));control.check();return result
   }catch(error){settings.signal?.throwIfAborted();const status=receipt?.response?.status;if(status&&status!==200&&errorValue(error,'status')===status)stopped=error;else{stopped??=error;control.check()}throw error}
  })()
  activeReads.add(pending);pending.then(()=>activeReads.delete(pending),()=>activeReads.delete(pending));return pending
 }
 const entryFor=record=>{const id=String(record.id);if(!entries.has(id))entries.set(id,{listing:structuredClone(record),closingListing:null,apiRow:null,opening:null,closing:null,partialOpening:null,partialClosing:null});return entries.get(id)}
 const apiRead=url=>bounded(async()=>{try{
  if(url===PRIMARY){apiPhase=++apiPhaseCount===1?'api-opening':'api-closing';const p=await read(url,'html',apiPhase);primary(p.body);return {url:p.url,status:p.status,headers:p.headers,bodyBase64:p.rawBodyBase64}}
  const u=new URL(url),ownMatch=/^\/v1\/boards\/doximity\/jobs\/(\d+)$/.exec(u.pathname)
  need(u.origin==='https://boards-api.greenhouse.io'&&!u.username&&!u.password&&!u.hash&&(url===API||url===API+'/offices'||url===API+'/jobs?content=true'||ownMatch&&u.search==='?pay_transparency=true'&&entries.has(ownMatch[1])),'unqualified native API read')
  const p=await read(url,'json',apiPhase),value=strictJSON(p.body);need(!nativeEnvelopeFailed(value),'native API failure envelope')
  if(url===API)need(value.name==='Doximity','native API board publisher conflict')
  if(url===API+'/jobs?content=true'){
   need(Array.isArray(value.jobs),'native API listing missing');apiListingHistory.push(structuredClone(value.jobs));const ids=new Set()
   for(const record of value.jobs){need(Number.isSafeInteger(record?.id)&&record.id>0&&!ids.has(record.id),'duplicate/invalid API post ID');ids.add(record.id)}
   need(value.meta?.total===value.jobs.length&&ids.size===entries.size&&[...ids].every(id=>entries.has(String(id))),'API/current hosted listing cohort conflict')
  }
  if(ownMatch){
   const id=ownMatch[1];if(!apiOriginalModels.has(id))apiOriginalModels.set(id,[]);apiOriginalModels.get(id).push(structuredClone(value))
   const listing=entries.get(id).listing;need(value.id===Number(id)&&value.company_name==='Doximity'&&value.absolute_url===ownURL(id)&&value.internal_job_id===listing.internal_job_id&&value.title===listing.title&&value.location?.name===listing.location,'native API/current hosted role identity conflict')
  }
  return {url:p.url,status:p.status,headers:p.headers,bodyBase64:p.rawBodyBase64}
 }catch(error){settings.signal?.throwIfAborted();stopped??=error;throw error}},{signal:control.signal,timeoutMs:settings.nativeReadTimeoutMs??settings.readTimeoutMs,code:'GREENHOUSE_READ_TIMEOUT'})
 const collectBoard=async()=>{
  const declaration=primary((await read(PRIMARY)).body),handoff=embed((await read(EMBED,'declared-script')).body),page=await read(BOARD),listing=board(page.body,record=>{const value=entryFor(record);if(phase==='closing')value.closingListing=structuredClone(record)})
  return {phase,declaration,handoff,...listing}
 }
 const baseRows=()=>[...entries.entries()].map(([id,value])=>{
  const row=structuredClone(value.apiRow??{source:'doximity',jobId:id,title:value.listing.title,company:'Doximity',country:null,sourceCountryScopeUnresolved:true,sourceNativePostKind:'unresolved',sourceNativeIssues:[]}),openingModel=value.opening??value.partialOpening,closingModel=value.closing??value.partialClosing
  row.sourceNativeRecord??=structuredClone(apiOriginalModels.get(id)?.[0]??null);row.sourceNativeAPIModelHistory=structuredClone(apiOriginalModels.get(id)??[])
  row.sourceNativeHostedListingRecord=structuredClone(value.listing);row.sourceNativeHostedClosingListingRecord=structuredClone(value.closingListing)
  row.sourceNativePublishedModel=structuredClone(openingModel?.model??null);row.sourceNativePublishedClosingModel=structuredClone(closingModel?.model??null)
  row.sourceNativePublishedRouteModel=structuredClone(openingModel?.route??null);row.sourceNativePublishedClosingRouteModel=structuredClone(closingModel?.route??null)
  row.sourceNativePublishedContext=structuredClone(openingModel?.context??null);row.sourceNativePublishedClosingContext=structuredClone(closingModel?.context??null)
  row.sourceNativeOwnDescription=value.opening?.description??null;row.sourceNativeOwnDescriptionHTML=value.opening?.descriptionHTML??null
  row.sourceNativeClosingOwnDescription=value.closing?.description??null;row.sourceNativeClosingOwnDescriptionHTML=value.closing?.descriptionHTML??null
  row.sourceNativeOwnHostedPageReadThisRun=Boolean(openingModel);row.sourceNativeOpeningPublication=structuredClone(value.opening?.publication??null);row.sourceNativeClosingPublication=structuredClone(value.closing?.publication??null)
  row.sourceNativeOwnCanonical=value.opening?.originalCanonical??null;row.sourceNativeClosingCanonical=value.closing?.originalCanonical??null
  row.activeApplyVerified=false;row.applicationVisited=false;row.sourceNativeActiveHiringVerified=false;row.sourceScopeComplete=false;row.lifecycleCleanupAllowed=false
  row.sourceNativePublishedLocationEvidence={originalLocation:value.opening?.model.job_post_location??null,matchesAPI:value.opening?.model.job_post_location===row.sourceNativeRecord?.location?.name,companyAddressUsed:false,applicationFormCountriesUsed:false}
  return row
 })
 const snapshot=()=>({source:'doximity',recordKind:'vacancy-rows',observedAt,admissionAt,opening,closing,apiAudit,apiListingHistory,observations:rows.length?rows:baseRows(),rawResponses:responses,rawPages:apiAudit?.rawPages??[],sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,authoritativeSourceTotal:null,authoritativeIndiaFacetCount:null,nativeBoardTotal:opening?.nativeBoardTotal??null,completeAPIModels:[...apiOriginalModels.values()].filter(v=>v.length).length,retainedHostedModels:[...entries.values()].filter(v=>v.opening||v.partialOpening).length,completeHostedCriteria:[...entries.values()].filter(v=>v.opening).length,qualification:'Complete API and hosted native models retained. Current hosted publication and visible criteria are separate from active hiring, whole-company/India-zero, applications, persistence and public visibility.'})
 const collectOwn=async()=>{for(const [id,value] of entries){control.check();const response=await read(ownURL(id)),parsed=own(response.body,value.listing,value.apiRow.sourceNativeRecord,clock(),model=>{if(phase==='opening')value.partialOpening=structuredClone(model);else value.partialClosing=structuredClone(model)});if(phase==='opening')value.opening=parsed;else value.closing=parsed;control.check()}}
 const refresh=guard=>{
  guard();admissionAt=clock();rows=baseRows();const boardStable=isDeepStrictEqual(opening.records,closing.records)
  for(const row of rows){
   guard();const value=entries.get(row.jobId),history=apiAudit.observationHistory.find(v=>String(v.postId)===row.jobId),apiStable=Boolean(history)&&isDeepStrictEqual(history.earlier.sourceNativeRecord,history.current.sourceNativeRecord),paired=Boolean(value.opening&&value.closing)&&isDeepStrictEqual(roleEvidence(value.opening.model),roleEvidence(value.closing.model))&&value.opening.description===value.closing.description&&value.opening.descriptionHTML===value.closing.descriptionHTML
   row.sourceNativeCompleteHostedModelsIdentical=Boolean(value.opening&&value.closing)&&isDeepStrictEqual(value.opening.model,value.closing.model)
   row.sourceNativeApplicationFieldsChanged=value.opening&&value.closing?[...applicationOnlyFields].filter(key=>!isDeepStrictEqual(value.opening.model[key],value.closing.model[key])):[]
   row.sourceNativeUnmappedAPIFields=Object.keys(row.sourceNativeRecord??{}).filter(key=>!API_FIELDS.includes(key));row.sourceNativeUnmappedPublishedFields=Object.keys(value.opening?.model??{}).filter(key=>!POST_FIELDS.includes(key))
   row.sourceNativePublishedContractQualified=!row.sourceNativeUnmappedAPIFields.length&&!row.sourceNativeUnmappedPublishedFields.length
   row.sourceNativeRoleEvidencePairQualified=paired&&apiStable&&boardStable&&apiAudit.opening.qualified&&apiAudit.closing.qualified
   row.sourceNativeAdmissionPublication=publication(value.opening.model,value.listing,row.sourceNativeRecord,admissionAt);row.sourceNativeAdmissionAt=admissionAt
   row.sourceNativeTemporalQualified=Boolean(row.sourceNativeRoleEvidencePairQualified&&row.sourceNativePublishedContractQualified&&value.opening.publication.qualified&&value.closing.publication.qualified&&row.sourceNativeAdmissionPublication.qualified)
   row.sourceCountryScopeUnresolved=row.sourceCountryScopeUnresolved||!row.sourceNativePublishedContractQualified
   row.sourceCurrentNativePostingIdentityQualified=row.sourceNativeTemporalQualified
   row.sourceCurrentNativeRoleQualified=row.sourceNativeTemporalQualified&&row.sourceNativePostKind==='job'&&row.country!==null&&!row.sourceCountryScopeUnresolved&&!row.sourceNativeCountryConflict
   row.sourceNativeIssues=[...new Set([...(row.sourceNativeIssues??[]),...value.opening.publication.issues,...value.closing.publication.issues,...row.sourceNativeAdmissionPublication.issues,...(row.sourceNativeRoleEvidencePairQualified?[]:['complete-native-opening-closing-evidence-changed']),...(row.sourceNativePublishedContractQualified?[]:['unmapped-native-publication-fields'])])]
   row.sourceDetailComplete=Boolean(value.opening&&value.closing&&row.sourceNativeDetailQualified);row.nativeDescriptionVisibilityQualified=paired
   const original=row.jobDescription??'',published=value.opening.description;row.jobDescription=original.includes(published)?original:original+'\n\nPublished own-page criteria: '+published;row.sourceDescription=row.jobDescription
   row.sourcePostingDate=row.sourcePostingDate??row.sourceNativeRecord.first_published;row.sourceNativeCurrentPublishedAt=value.opening.model.published_at;row.companyCareerPage=PRIMARY;row.companyDomain='doximity.com';row.scrapedAt=observedAt
  }
  guard()
 }
 try{
  observedAt=clock();opening=await collectBoard();control.check()
  phase='api';await createNativeGreenhouseScraper(PROFILE).run({...settings,signal:control.signal,maxJobs:0,maxPages:null,nativeReadTimeoutMs:settings.nativeReadTimeoutMs??settings.readTimeoutMs,fetchPage:apiRead,onAudit:value=>{apiAudit=value;for(const row of value.observations){need(entries.has(row.jobId),'unreconciled API post');entries.get(row.jobId).apiRow=structuredClone(row)}},onRecords:undefined,now:()=>clock()});control.check();if(stopped)throw stopped
  need(apiAudit?.opening?.qualified&&apiAudit.closing?.qualified&&apiAudit.observations.length===entries.size&&[...entries.values()].every(v=>v.apiRow?.sourceNativeDetailQualified),'complete native API corpus is unqualified')
  phase='opening';await collectOwn();phase='closing';closing=await collectBoard();need(entries.size===opening.records.length&&isDeepStrictEqual(opening.records,closing.records),'current published native cohort changed');await collectOwn();control.check()
  await bounded(async(signal,check)=>{const guard=()=>{control.check();check()};refresh(guard);if(settings.onAudit){guard();const value=structuredClone(snapshot());guard();await settings.onAudit(value,{signal},guard);guard();refresh(guard)}if(settings.onRecords){guard();const value=structuredClone(rows);guard();await settings.onRecords(value,{signal},guard);guard();refresh(guard)}},{signal:control.signal,timeoutMs:settings.auditTimeoutMs,code:'DOXIMITY_AUDIT_TIMEOUT'});control.check();refresh(()=>control.check())
  const eligible=row=>row.sourceNativeTemporalQualified&&row.sourceNativePostKind==='job'&&(row.country==='India'||row.sourceCountryScopeUnresolved),all=rows.filter(eligible)
  let jobs=structuredClone(settings.maxJobs===null?all:all.slice(0,settings.maxJobs));control.check();refresh(()=>control.check())
  const current=new Map(rows.filter(eligible).map(row=>[row.jobId,row]));jobs=jobs.filter(row=>current.has(row.jobId))
  for(const row of jobs){const latest=current.get(row.jobId);row.sourceNativeAdmissionAt=latest.sourceNativeAdmissionAt;row.sourceNativeAdmissionPublication=structuredClone(latest.sourceNativeAdmissionPublication);row.sourceNativeIssues=[...latest.sourceNativeIssues]}
  control.check();const audit=snapshot()
  Object.defineProperty(jobs,'sourceAudit',{value:audit});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit});attachSourceObservationEvidence(jobs,{...audit,observedRecordCount:rows.length,observedVacancyCount:rows.filter(v=>v.sourceNativePostKind==='job').length})
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:PRIMARY,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:control.requests,verifiedAt:admissionAt,reason:'full-native-API-plus-current-hosted-model-and-visible-criteria;unresolved-worksite-company-India-zero-hiring-application-and-publication-scope-held'})
 }catch(cause){
  if(!settings.signal?.aborted)apiAudit??=errorValue(cause,'nativeEvidence')??errorValue(cause,'sourceAudit')??null;acquisition.abort(cause);await Promise.allSettled([...activeReads]);rows=baseRows().map(row=>({...row,sourceCurrentNativePostingIdentityQualified:false,sourceCurrentNativeRoleQualified:false,sourceNativeTemporalQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,incompleteCollection:true}));const evidence=structuredClone(snapshot())
  if(settings.signal?.aborted){failures.set(settings.signal,evidence);throw settings.signal.reason}
  const primary=stopped??cause
  throw annotateFailure(primary,{source:'doximity',sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeEvidence:evidence})
 }finally{acquisition.abort();control.close()}
}})