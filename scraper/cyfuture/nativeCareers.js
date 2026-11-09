import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {INDEX,SOURCE,need,hash,equivalent,readIndex,readOfficeIndex,readRole,bindOfficeCountry} from './nativeModels.js'
import {createCyfuturePublicRead} from './publicRead.js'
const context=page=>({identity:page.identity,schemas:page.schemas,contactURL:page.contactURL,officeDeclarations:page.officeDeclarations,
 locationTabs:page.tabs.map(({attrs,label,paneAttrs})=>({attrs,label,paneAttrs}))})
export async function runCyfutureNative(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage&&!options.fetchBinary,'HTTP response metadata required; body-only transports unsupported')
 need(options.maxPages==null,'current native tabs have no supported page cap')
 const cap=options.maxJobs??Infinity;need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),receipts=[]
 const audit={source:SOURCE,observedAt:clock,nativeRecords:null,nativePositions:null,nativeRoleClosingReconciled:0,heldNativeRows:[],unknownCountryRoles:[],failures:[],
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,complete:false}
 let jobs=[],failure
 const finish=()=>{
  const result=jobs.slice(0,cap),observations={...structuredClone(audit),responses:structuredClone(receipts),returnedRecords:result.length,
   unresolved:['company-recruitment-scope-unverified',...(audit.unknownCountryRoles.length?['native-role-country-unproven']:[]),...(cap!==Infinity?['caller-result-limit']:[])],
   nativeInventoryReads:audit.nativeRecords===null?[]:[{kind:'official-native-location-tabs-and-whole-role-pages',surface:INDEX,reportedTotal:audit.nativeRecords}]}
  Object.defineProperty(result,Symbol.for('jobverify.verified-recruitment-observations'),{value:observations})
  if(audit.nativeRecords!==null)attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeRecords,
   observedVacancyCount:audit.nativeRecords,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(result.length)result[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:INDEX,firstParty:Boolean(audit.openingIndex?.nativeRecord),listingComplete:false,
   reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,reason:'Paired native role and declared office-country context; complete company scope and cleanup remain unqualified'})
 }
 const complete=async()=>{const result=finish();await options.onAudit?.(result[Symbol.for('jobverify.verified-recruitment-observations')]);options.signal?.throwIfAborted()
  if(failure&&!jobs.length)throw Object.assign(failure,{recruitmentObservations:result[Symbol.for('jobverify.verified-recruitment-observations')],inventoryEvidence:readInventoryEvidence(result)})
  return result}
 if(cap===0)return complete()
 const transport=createCyfuturePublicRead(options,receipts)
 const evidence=(receipt,nativeRecord=null)=>({rawHTML:receipt.rawHTML,bodySHA256:receipt.bodySHA256,nativeRecord:structuredClone(nativeRecord)})
 const original=job=>({nativeRecord:structuredClone(job.nativeSourceRecord),rawHTML:job.sourceRawNativeHTML,bodySHA256:job.sourceRawNativeHTMLSHA256})
 const hold=(job,reason,phase,closing)=>audit.heldNativeRows.push({jobId:job.jobId,title:job.title,reason,phase,opening:original(job),closing:structuredClone(closing)})
 const decorate=(job,page,offices)=>{job.nativeSourceRecord.index=structuredClone(context(page));job.nativeSourceRecord.offices=structuredClone(offices);return bindOfficeCountry(job,offices)}
 try{
  const first=await transport.read(INDEX);audit.openingIndex=evidence(first.receipt)
  const page=readIndex(first.receipt.rawHTML);audit.openingIndex.nativeRecord=structuredClone(page);audit.nativeRecords=page.rows.length
  audit.nativePositions=page.rows.reduce((n,row)=>n+row.numberOfOpenings,0)
  transport.allow(page.contactURL);const officeRead=await transport.read(page.contactURL);audit.openingOffices=evidence(officeRead.receipt)
  const offices=readOfficeIndex(officeRead.receipt.rawHTML);audit.openingOffices.nativeRecord=structuredClone(offices)
  for(const row of page.rows){
   transport.allow(row.sourceUrl);const current=await transport.read(row.sourceUrl)
   const job=decorate(readRole(current.receipt.rawHTML,row,{clock}),page,offices)
   for(const [key,q]of [['sourceRawNativeHTML',current.receipt],['sourceRawNativeIndexHTML',first.receipt],['sourceRawNativeOfficeHTML',officeRead.receipt]]){
    job[key]=q.rawHTML;job[key+'SHA256']=q.bodySHA256}
   jobs.push(job)
   if(!job.country)audit.unknownCountryRoles.push({jobId:job.jobId,title:job.title,nativeLocation:job.nativeLocation,country:null,reason:'native-office-country-unproven',nativeRecord:structuredClone(job.nativeSourceRecord)})
  }
  const indexClose=await transport.read(INDEX);audit.closingIndex=evidence(indexClose.receipt)
  let closingPage
  try{closingPage=readIndex(indexClose.receipt.rawHTML)}catch(error){for(const job of jobs)hold(job,error.message,'closing-index',audit.closingIndex);jobs=[];throw error}
  audit.closingIndex.nativeRecord=structuredClone(closingPage)
  for(const job of [...jobs]){
   const row=closingPage.rows.find(r=>r.jobId===job.jobId)
   if(!row||!equivalent(row,job.nativeSourceRecord.listing)||!equivalent(context(closingPage),job.nativeSourceRecord.index)){
    jobs=jobs.filter(j=>j!==job);hold(job,'closing native role/tab/publisher identity changed','closing-index',audit.closingIndex)
   }else{job.sourceClosingRawNativeIndexHTML=indexClose.receipt.rawHTML;job.sourceClosingRawNativeIndexHTMLSHA256=indexClose.receipt.bodySHA256}
  }
  const officeClose=await transport.read(closingPage.contactURL);audit.closingOffices=evidence(officeClose.receipt)
  let closedOffices
  try{closedOffices=readOfficeIndex(officeClose.receipt.rawHTML)}catch(error){for(const job of jobs)hold(job,error.message,'closing-offices',audit.closingOffices);jobs=[];throw error}
  audit.closingOffices.nativeRecord=structuredClone(closedOffices)
  if(!equivalent(offices,closedOffices)){
   for(const job of jobs)hold(job,'closing whole publisher office/country context changed','closing-offices',audit.closingOffices)
   jobs=[]
  }
  for(const job of [...jobs]){
   const current=await transport.read(job.sourceUrl),row=closingPage.rows.find(r=>r.jobId===job.jobId)
   let closed
   try{closed=decorate(readRole(current.receipt.rawHTML,row,{clock}),closingPage,closedOffices)}catch(error){jobs=jobs.filter(j=>j!==job);hold(job,error.message,'closing-role',evidence(current.receipt));throw error}
   if(!equivalent(job.nativeSourceRecord,closed.nativeSourceRecord)){
    jobs=jobs.filter(j=>j!==job);hold(job,'closing whole native role criteria changed','closing-role',evidence(current.receipt,closed.nativeSourceRecord));continue
   }
   job.nativeClosingRecord=structuredClone(closed.nativeSourceRecord);job.nativeRoleClosingReconciled=true;audit.nativeRoleClosingReconciled++
   job.sourceClosingRawNativeHTML=current.receipt.rawHTML;job.sourceClosingRawNativeHTMLSHA256=current.receipt.bodySHA256
   job.sourceClosingRawNativeOfficeHTML=officeClose.receipt.rawHTML;job.sourceClosingRawNativeOfficeHTMLSHA256=officeClose.receipt.bodySHA256
   if(job.country&&job.sourceNativeCriteriaContainerRetained){job.sourceDetailComplete=true;job.sourceDetailStatus='complete';job.sourceDetailFailureKind=null}
  }
 }catch(error){options.signal?.throwIfAborted();failure=error;audit.failures.push({message:error.message,status:error.status??null,requestUrl:error.requestUrl??null})
  for(const job of jobs){job.sourceDetailComplete=false;job.sourceDetailStatus='partial';if(job.country)job.sourceDetailFailureKind='native-collection-failed'}}
 finally{transport.close()}
 return complete()
}
