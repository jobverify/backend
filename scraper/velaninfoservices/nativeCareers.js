import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,SOURCE,need,equivalent,readCareers,readIndex,readOfficeIndex,readRole,bindOfficeCountry} from './nativeModels.js'
import {createVelanPublicRead} from './publicRead.js'
const indexContext=page=>({identity:page.identity,schemas:page.schemas,groups:page.groups.map(({heading,attrs})=>({heading,attrs}))})
export async function runVelanNative(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage&&!options.fetchBinary,'HTTP response metadata required; body-only transports unsupported')
 need(options.maxPages==null,'native single-page listing has no supported page cap')
 const cap=options.maxJobs??Infinity;need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),receipts=[]
 const audit={source:SOURCE,observedAt:clock,nativeRecords:null,nativePositions:null,nativeRoleClosingReconciled:0,heldNativeRows:[],unknownCountryRoles:[],failures:[],
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,complete:false}
 let jobs=[],failure
 const finish=()=>{
  const result=jobs.slice(0,cap),observations={...structuredClone(audit),responses:structuredClone(receipts),returnedRecords:result.length,
   unresolved:['company-recruitment-scope-unverified',...(audit.unknownCountryRoles.length?['native-role-country-unproven']:[]),...(cap!==Infinity?['caller-result-limit']:[])],
   nativeInventoryReads:audit.nativeRecords===null?[]:[{kind:'official-native-groups-and-whole-own-role-pages',surface:CAREERS,reportedTotal:audit.nativeRecords}]}
  Object.defineProperty(result,Symbol.for('jobverify.verified-recruitment-observations'),{value:observations})
  if(audit.nativeRecords!==null)attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeRecords,
   observedVacancyCount:audit.nativeRecords,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(result.length)result[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:CAREERS,firstParty:Boolean(audit.openingCareers?.nativeRecord),listingComplete:false,
   reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,
   reason:'Paired full native role and declared worksite-country context; complete company scope and cleanup remain unqualified'})
 }
 const complete=async()=>{
  const result=finish();options.signal?.throwIfAborted()
  if(options.onAudit){
   let abort
   const cancelled=new Promise((_,reject)=>{abort=()=>reject(options.signal.reason);options.signal?.addEventListener('abort',abort,{once:true})})
   try{await Promise.race([Promise.resolve().then(()=>options.onAudit(result[Symbol.for('jobverify.verified-recruitment-observations')])),cancelled])}
   finally{options.signal?.removeEventListener('abort',abort)}
  }
  options.signal?.throwIfAborted()
  if(failure&&!jobs.length)throw Object.assign(failure,{recruitmentObservations:result[Symbol.for('jobverify.verified-recruitment-observations')],inventoryEvidence:readInventoryEvidence(result)})
  return result
 }
 if(cap===0)return complete()
 const transport=createVelanPublicRead(options,receipts)
 const evidence=(q,nativeRecord=null)=>({rawHTML:q.rawHTML,bodySHA256:q.bodySHA256,nativeRecord:structuredClone(nativeRecord)})
 const original=job=>({nativeRecord:structuredClone(job.nativeSourceRecord),rawHTML:job.sourceRawNativeHTML,bodySHA256:job.sourceRawNativeHTMLSHA256})
 const hold=(job,reason,phase,closing)=>audit.heldNativeRows.push({jobId:job.jobId,title:job.title,reason,phase,opening:original(job),closing:structuredClone(closing)})
 const compare=(opening,closing,affected,phase,receipt)=>{
  try{return equivalent(opening,closing)}catch(error){
   for(const job of affected){jobs=jobs.filter(j=>j!==job);hold(job,error.message,phase,receipt)}
   throw error
  }
 }
 const decorate=(job,careers,page,offices)=>{
  job.nativeSourceRecord.careers=structuredClone(careers);job.nativeSourceRecord.index=structuredClone(indexContext(page));job.nativeSourceRecord.offices=structuredClone(offices)
  return bindOfficeCountry(job,offices)
 }
 try{
  const first=await transport.read(CAREERS);audit.openingCareers=evidence(first.receipt)
  const careers=readCareers(first.receipt.rawHTML);audit.openingCareers.nativeRecord=structuredClone(careers)
  transport.allow(careers.jobsURL);transport.allow(careers.contactURL)
  const indexRead=await transport.read(careers.jobsURL);audit.openingIndex=evidence(indexRead.receipt)
  const page=readIndex(indexRead.receipt.rawHTML);audit.openingIndex.nativeRecord=structuredClone(page);audit.nativeRecords=page.rows.length
  audit.nativePositions=page.rows.reduce((n,r)=>n+r.numberOfOpenings,0)
  const officeRead=await transport.read(careers.contactURL);audit.openingOffices=evidence(officeRead.receipt)
  const offices=readOfficeIndex(officeRead.receipt.rawHTML);audit.openingOffices.nativeRecord=structuredClone(offices)
  for(const row of page.rows){
   transport.allow(row.sourceUrl);const current=await transport.read(row.sourceUrl),job=decorate(readRole(current.receipt.rawHTML,row,{clock}),careers,page,offices)
   for(const [key,q]of [['sourceRawNativeHTML',current.receipt],['sourceRawNativeCareersHTML',first.receipt],['sourceRawNativeIndexHTML',indexRead.receipt],['sourceRawNativeOfficeHTML',officeRead.receipt]]){
    job[key]=q.rawHTML;job[key+'SHA256']=q.bodySHA256}
   jobs.push(job)
   if(!job.country)audit.unknownCountryRoles.push({jobId:job.jobId,title:job.title,nativeLocation:job.nativeLocation,country:null,reason:'native-worksite-country-unproven',nativeRecord:structuredClone(job.nativeSourceRecord)})
  }
  const careersClose=await transport.read(CAREERS);audit.closingCareers=evidence(careersClose.receipt)
  let closedCareers
  try{closedCareers=readCareers(careersClose.receipt.rawHTML)}catch(error){for(const j of jobs)hold(j,error.message,'closing-careers',audit.closingCareers);jobs=[];throw error}
  audit.closingCareers.nativeRecord=structuredClone(closedCareers)
  if(!compare(careers,closedCareers,[...jobs],'closing-careers',audit.closingCareers)){for(const j of jobs)hold(j,'closing publisher/careers declaration changed','closing-careers',audit.closingCareers);jobs=[];need(false,'closing publisher/careers declaration changed')}
  const indexClose=await transport.read(closedCareers.jobsURL);audit.closingIndex=evidence(indexClose.receipt)
  let closedPage
  try{closedPage=readIndex(indexClose.receipt.rawHTML)}catch(error){for(const j of jobs)hold(j,error.message,'closing-index',audit.closingIndex);jobs=[];throw error}
  audit.closingIndex.nativeRecord=structuredClone(closedPage)
  for(const job of [...jobs]){
   const row=closedPage.rows.find(r=>r.jobId===job.jobId)
   if(!row||!compare(row,job.nativeSourceRecord.listing,[job],'closing-index',audit.closingIndex)||!compare(indexContext(page),indexContext(closedPage),[...jobs],'closing-index',audit.closingIndex)){
    jobs=jobs.filter(j=>j!==job);hold(job,'closing whole native role/group metadata changed','closing-index',audit.closingIndex)
   }else{
    job.sourceClosingRawNativeCareersHTML=careersClose.receipt.rawHTML;job.sourceClosingRawNativeCareersHTMLSHA256=careersClose.receipt.bodySHA256
    job.sourceClosingRawNativeIndexHTML=indexClose.receipt.rawHTML;job.sourceClosingRawNativeIndexHTMLSHA256=indexClose.receipt.bodySHA256
   }
  }
  const officeClose=await transport.read(closedCareers.contactURL);audit.closingOffices=evidence(officeClose.receipt)
  let closedOffices
  try{closedOffices=readOfficeIndex(officeClose.receipt.rawHTML)}catch(error){for(const j of jobs)hold(j,error.message,'closing-offices',audit.closingOffices);jobs=[];throw error}
  audit.closingOffices.nativeRecord=structuredClone(closedOffices)
  if(!compare(offices,closedOffices,[...jobs],'closing-offices',audit.closingOffices)){
   for(const j of jobs)hold(j,'closing whole native office-country context changed','closing-offices',audit.closingOffices);jobs=[]
  }
  for(const job of [...jobs]){
   const current=await transport.read(job.sourceUrl),row=closedPage.rows.find(r=>r.jobId===job.jobId);let closed
   try{closed=decorate(readRole(current.receipt.rawHTML,row,{clock}),closedCareers,closedPage,closedOffices)}catch(error){jobs=jobs.filter(j=>j!==job);hold(job,error.message,'closing-role',evidence(current.receipt));throw error}
   if(!compare(job.nativeSourceRecord,closed.nativeSourceRecord,[job],'closing-role',evidence(current.receipt,closed.nativeSourceRecord))){
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
