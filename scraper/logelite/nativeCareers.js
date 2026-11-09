import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,SOURCE,need,readCareers,readRole,makeJob,equivalent} from './nativeModels.js'
import {readLogelitePDF} from './pdfDocument.js'
import {createLogelitePublicRead} from './publicRead.js'
export async function runLogeliteNative(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchPage&&!options.fetchBinary&&!options.fetchJson,'HTTP response metadata required; body-only transports unsupported')
 need(options.maxPages==null,'declared corporate role grid has no supported page cap')
 const cap=options.maxJobs??Infinity;need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),receipts=[]
 const audit={source:SOURCE,observedAt:clock,nativeRecords:null,nativeRoleClosingReconciled:0,heldNativeRows:[],unknownCountryRoles:[],failures:[],complete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 let jobs=[],failure
 const finish=()=>{
  const result=jobs.slice(0,cap),observations={...structuredClone(audit),responses:structuredClone(receipts),returnedRecords:result.length,
   unresolved:['company-recruitment-scope-unverified',...(audit.unknownCountryRoles.length?['native-role-country-unproven']:[]),...(cap!==Infinity?['caller-result-limit']:[])]}
  Object.defineProperty(result,Symbol.for('jobverify.verified-recruitment-observations'),{value:observations})
  if(audit.nativeRecords!==null)attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeRecords,observedVacancyCount:audit.nativeRecords,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(result.length)result[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:CAREERS,firstParty:Boolean(audit.openingCareers?.nativeRecord),listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,
   reason:'Paired current publisher cards, own role regions and complete declared native PDF documents; company scope and cleanup unqualified'})
 }
 const complete=async()=>{
  const result=finish();options.signal?.throwIfAborted()
  if(options.onAudit){let abort;const cancelled=new Promise((_,reject)=>{abort=()=>reject(options.signal.reason);options.signal?.addEventListener('abort',abort,{once:true})})
   try{await Promise.race([Promise.resolve().then(()=>options.onAudit(result[Symbol.for('jobverify.verified-recruitment-observations')])),cancelled])}finally{options.signal?.removeEventListener('abort',abort)}}
  options.signal?.throwIfAborted()
  if(failure&&!jobs.length)throw Object.assign(failure,{recruitmentObservations:result[Symbol.for('jobverify.verified-recruitment-observations')],inventoryEvidence:readInventoryEvidence(result)})
  return result
 }
 if(cap===0)return complete()
 const transport=createLogelitePublicRead(options,receipts),evidence=(receipt,nativeRecord=null)=>({...structuredClone(receipt),nativeRecord:structuredClone(nativeRecord)})
 const original=job=>({rawHTML:job.sourceRawNativeHTML,bodyBase64:job.sourceRawNativePDFBase64,nativeRecord:structuredClone(job.nativeSourceRecord)})
 const hold=(job,reason,phase,closing)=>{jobs=jobs.filter(j=>j!==job);audit.heldNativeRows.push({sourceUrl:job.sourceUrl,title:job.title,reason,phase,opening:original(job),closing:structuredClone(closing)})}
 const holdAll=(reason,phase,closing)=>{for(const job of [...jobs])hold(job,reason,phase,closing)}
 const assign=(job,careers,role,pdf,aliases,prefix='source')=>{
  job[prefix+'RawNativeCareersHTML']=careers.rawHTML;job[prefix+'RawNativeCareersHTMLSHA256']=careers.bodySHA256
  job[prefix+'RawNativeHTML']=role.rawHTML;job[prefix+'RawNativeHTMLSHA256']=role.bodySHA256
  job[prefix+'RawNativePDFBase64']=pdf.bodyBase64;job[prefix+'RawNativePDFSHA256']=pdf.bodySHA256;job[prefix+'NativePDFRendererAliases']=structuredClone(aliases)
 }
 try{
  const first=await transport.read(CAREERS);audit.openingCareers=evidence(first.receipt)
  const page=readCareers(first.receipt.rawHTML);audit.openingCareers.nativeRecord=structuredClone(page);audit.nativeRecords=page.rows.length
  for(const row of page.rows){
   transport.allow(row.sourceUrl);const roleRead=await transport.read(row.sourceUrl),role=readRole(roleRead.receipt.rawHTML,row)
   transport.allow(row.pdfURL);const pdfRead=await transport.read(row.pdfURL),pdf=await readLogelitePDF(pdfRead.bytes,{signal:transport.signal}),job=makeJob(row,role,pdf.document,page,clock)
   assign(job,first.receipt,roleRead.receipt,pdfRead.receipt,pdf.rendererAliases);jobs.push(job)
   if(!job.country)audit.unknownCountryRoles.push({sourceUrl:job.sourceUrl,title:job.title,country:null,nativeRecord:structuredClone(job.nativeSourceRecord)})
  }
  const close=await transport.read(CAREERS);audit.closingCareers=evidence(close.receipt);let closedPage
  try{closedPage=readCareers(close.receipt.rawHTML)}catch(error){holdAll(error.message,'closing-careers',audit.closingCareers);throw error}
  audit.closingCareers.nativeRecord=structuredClone(closedPage)
  if(!equivalent(page,closedPage)){holdAll('closing whole publisher role context changed','closing-careers',audit.closingCareers);need(false,'closing publisher context changed')}
  for(const job of [...jobs]){
   const row=closedPage.rows.find(r=>r.sourceUrl===job.sourceUrl),roleRead=await transport.read(job.sourceUrl);let role
   try{role=readRole(roleRead.receipt.rawHTML,row)}catch(error){hold(job,error.message,'closing-role',{rawHTML:roleRead.receipt.rawHTML});throw error}
   if(!equivalent(job.nativeSourceRecord.role,role)){hold(job,'closing whole role model changed','closing-role',{rawHTML:roleRead.receipt.rawHTML,nativeRecord:{role:structuredClone(role)}});continue}
   const pdfRead=await transport.read(row.pdfURL),closing={rawHTML:roleRead.receipt.rawHTML,bodyBase64:pdfRead.receipt.bodyBase64,nativeRecord:{listing:structuredClone(row),role:structuredClone(role),pdf:null,careers:structuredClone(closedPage)}}
   let pdf,closed
   try{pdf=await readLogelitePDF(pdfRead.bytes,{signal:transport.signal});closing.nativeRecord.pdf=pdf.document;closed=makeJob(row,role,pdf.document,closedPage,clock)}catch(error){hold(job,error.message,'closing-pdf',closing);throw error}
   if(!equivalent(job.nativeSourceRecord,closed.nativeSourceRecord)){hold(job,'closing whole role/PDF model changed','closing-pdf',closing);continue}
   job.nativeClosingRecord=structuredClone(closed.nativeSourceRecord);job.nativeRoleClosingReconciled=true;audit.nativeRoleClosingReconciled++
   assign(job,close.receipt,roleRead.receipt,pdfRead.receipt,pdf.rendererAliases,'sourceClosing')
   if(job.country){job.sourceDetailComplete=true;job.sourceDetailStatus='complete';job.sourceDetailFailureKind=null}
  }
 }catch(error){options.signal?.throwIfAborted();failure=error;audit.failures.push({message:error.message,status:error.status??null,requestUrl:error.requestUrl??null})
  for(const job of jobs){job.sourceDetailComplete=false;job.sourceDetailStatus='partial';if(job.country)job.sourceDetailFailureKind='native-collection-failed'}}
 finally{transport.close()}
 return complete()
}
