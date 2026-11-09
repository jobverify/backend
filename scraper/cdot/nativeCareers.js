import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CURRENT_OPENINGS_URL,SOURCE,need,hash,same,readCdotListing} from './nativeModels.js'
import {readCdotAdvertisement} from './nativeAdvertisement.js'
import {createCdotPublicRead} from './publicRead.js'
export async function runCdotNative(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchBinary&&!options.fetchJson,'HTTP response metadata required; body-only transports unsupported')
 need(options.maxPages==null,'current native table has no supported page cap')
 const cap=options.maxJobs??Infinity
 need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),receipts=[]
 const audit={source:SOURCE,observedAt:clock,nativeRecords:null,nativePositions:null,nativePositionsObserved:null,nativeRoleClosingReconciled:0,
  heldNativeRows:[],unknownCountryRoles:[],failures:[],sourceScopeComplete:false,lifecycleCleanupAllowed:false,complete:false}
 let jobs=[],failure
 const finish=()=>{
  const result=jobs.slice(0,cap),observations={...structuredClone(audit),responses:structuredClone(receipts),returnedRecords:result.length,
   unresolved:['company-recruitment-scope-unverified',...(audit.unknownCountryRoles.length?['native-role-country-unproven']:[]),...(cap!==Infinity?['caller-result-limit']:[])],
   nativeInventoryReads:audit.nativeRecords===null?[]:[{kind:'official-table-and-whole-bilingual-native-advertisements',surface:CURRENT_OPENINGS_URL,reportedTotal:audit.nativeRecords}]}
  Object.defineProperty(result,Symbol.for('jobverify.verified-recruitment-observations'),{value:observations})
  if(audit.nativeRecords!==null)attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeRecords,
   observedVacancyCount:audit.nativeRecords,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(result.length)result[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:CURRENT_OPENINGS_URL,firstParty:Boolean(audit.openingIndex?.nativeRecord),
   listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,
   reason:'Whole native advertisement criteria retained; complete company scope and cleanup remain unqualified'})
 }
 const complete=async()=>{const result=finish();await options.onAudit?.(result[Symbol.for('jobverify.verified-recruitment-observations')]);options.signal?.throwIfAborted()
  if(failure&&!jobs.length)throw Object.assign(failure,{recruitmentObservations:result[Symbol.for('jobverify.verified-recruitment-observations')],inventoryEvidence:readInventoryEvidence(result)})
  return result}
 if(cap===0)return complete()
 const transport=createCdotPublicRead(options,receipts)
 const indexEvidence=(html,nativeRecord=null)=>({rawHTML:html,bodySHA256:hash(html),nativeRecord:structuredClone(nativeRecord)})
 const original=job=>({nativeRecord:structuredClone(job.nativeSourceRecord),rawHTML:job.sourceRawNativeHTML,
  bodyBase64:job.sourceRawNativePDFBase64,bodySHA256:job.sourceNativePDFSHA256})
 const hold=(job,reason,phase,closing)=>audit.heldNativeRows.push({jobId:job.jobId,title:job.title,reason,phase,opening:original(job),closing:structuredClone(closing)})
 try{
  const first=await transport.read(CURRENT_OPENINGS_URL),html=first.receipt.rawHTML
  audit.openingIndex=indexEvidence(html)
  const page=readCdotListing(html);audit.openingIndex.nativeRecord=structuredClone(page);audit.nativeRecords=page.rows.length
  for(const row of page.rows){
   transport.allowPDF(row.sourceUrl)
   const current=await transport.read(row.sourceUrl),job=await readCdotAdvertisement(current.bytes,row,{signal:transport.signal,page,clock})
   job.sourceRawNativeHTML=html;job.sourceRawNativeHTMLSHA256=first.receipt.bodySHA256
   job.sourceRawNativePDFBase64=current.receipt.bodyBase64;job.sourceRawNativePDFSHA256=current.receipt.bodySHA256
   audit.nativePositionsObserved=(audit.nativePositionsObserved??0)+job.numberOfOpenings;jobs.push(job)
   if(!job.country)audit.unknownCountryRoles.push({jobId:job.jobId,title:job.title,nativeWorkplace:job.nativeWorkplace,country:null,
    reason:'native-country-unproven',nativeRecord:structuredClone(job.nativeSourceRecord)})
  }
  audit.nativePositions=audit.nativePositionsObserved
  const last=await transport.read(CURRENT_OPENINGS_URL),previous=jobs;transport.signal.throwIfAborted();jobs=[]
  audit.closingIndex=indexEvidence(last.receipt.rawHTML)
  let closingPage
  try{closingPage=readCdotListing(last.receipt.rawHTML)}catch(error){for(const job of previous)hold(job,error.message,'closing-index',audit.closingIndex);throw error}
  audit.closingIndex.nativeRecord=structuredClone(closingPage)
  for(const job of previous){
   const row=closingPage.rows.find(r=>r.jobId===job.jobId)
   if(row&&same(row,job.nativeSourceRecord.listing)&&same({identity:closingPage.identity,schemas:closingPage.schemas},job.nativeSourceRecord.index)){
    job.sourceClosingRawNativeHTML=last.receipt.rawHTML;job.sourceClosingRawNativeHTMLSHA256=last.receipt.bodySHA256;jobs.push(job)
   }else hold(job,'closing advertised identity or native row/context changed','closing-index',audit.closingIndex)
  }
  for(const job of [...jobs]){
   const closing=await transport.read(job.sourceUrl)
   jobs=jobs.filter(j=>j!==job)
   let closed
   try{closed=await readCdotAdvertisement(closing.bytes,closingPage.rows.find(r=>r.jobId===job.jobId),{signal:transport.signal,page:closingPage,clock})}
   catch(error){hold(job,error.message,'closing-advertisement',closing.receipt);throw error}
   if(same(job.nativeSourceRecord,closed.nativeSourceRecord)){
    job.nativeClosingRecord=structuredClone(closed.nativeSourceRecord);job.sourceClosingRawNativePDFBase64=closing.receipt.bodyBase64
    job.sourceClosingRawNativePDFSHA256=closing.receipt.bodySHA256;job.sourceClosingNativePDFRendererFontAliases=structuredClone(closed.sourceNativePDFRendererFontAliases)
    job.nativeRoleClosingReconciled=true;audit.nativeRoleClosingReconciled++
    if(job.country&&job.sourceNativeCriteriaContainerRetained){job.sourceDetailComplete=true;job.sourceDetailStatus='complete';job.sourceDetailFailureKind=null}
    jobs.push(job)
   }else hold(job,'closing whole native advertisement model changed','closing-advertisement',{...closing.receipt,nativeRecord:closed.nativeSourceRecord})
  }
 }catch(error){options.signal?.throwIfAborted();failure=error;audit.failures.push({message:error.message,status:error.status??null,requestUrl:error.requestUrl??null})}
 finally{transport.close()}
 return complete()
}
