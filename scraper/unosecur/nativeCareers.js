import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,SOURCE,need,readCareers,readRole,readClient,makeJob,apiURL,equivalent} from './nativeModels.js'
import {createUnosecurPublicRead} from './publicRead.js'
export async function runUnosecurNative(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchPage&&!options.fetchJson&&!options.fetchBinary,'HTTP response metadata required; body-only transports unsupported')
 need(options.maxPages==null,'single declared corporate role set has no supported page cap')
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
   reason:'Paired publisher, current declared read/render contract, complete own role metadata and native public job-data models; full company scope and cleanup remain unqualified'})
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
 const transport=createUnosecurPublicRead(options,receipts),evidence=(q,nativeRecord=null)=>({rawText:q.rawText,bodySHA256:q.bodySHA256,nativeRecord:structuredClone(nativeRecord)})
 const original=j=>({rawHTML:j.sourceRawNativeHTML,rawAPIJSON:j.sourceRawNativeAPIJSON,nativeRecord:structuredClone(j.nativeSourceRecord)})
 const hold=(j,reason,phase,closing)=>{jobs=jobs.filter(v=>v!==j);audit.heldNativeRows.push({jobId:j.jobId,title:j.title,reason,phase,opening:original(j),closing:structuredClone(closing)})}
 const holdAll=(reason,phase,closing)=>{for(const j of [...jobs])hold(j,reason,phase,closing)}
 const assign=(j,fields)=>{for(const [key,q]of fields){j[key]=q.rawText;j[key+'SHA256']=q.bodySHA256}}
 try{
  const first=await transport.read(CAREERS);audit.openingCareers=evidence(first.receipt)
  const page=readCareers(first.receipt.rawText);audit.openingCareers.nativeRecord=structuredClone(page);audit.nativeRecords=page.rows.length
  let client,clientRead
  for(const row of page.rows){
   transport.allow(row.sourceUrl,'html');const roleRead=await transport.read(row.sourceUrl),role=readRole(roleRead.receipt.rawText,row)
   if(!client){transport.allow(role.clientURL,'javascript');clientRead=await transport.read(role.clientURL);audit.openingClient=evidence(clientRead.receipt);client=readClient(clientRead.receipt.rawText,role.clientURL);audit.openingClient.nativeRecord=structuredClone(client)}
   need(role.clientURL===client.url,'different declared native client requires review')
   const url=apiURL(row.sourceUrl,client);transport.allow(url,'json');const data=await transport.read(url),job=makeJob(data.receipt.rawText,row,role,page,client,clock)
   assign(job,[['sourceRawNativeHTML',roleRead.receipt],['sourceRawNativeCareersHTML',first.receipt],['sourceRawNativeClientJS',clientRead.receipt],['sourceRawNativeAPIJSON',data.receipt]])
   const duplicate=jobs.find(j=>j.jobId===job.jobId)
   if(duplicate){const reason='conflicting native roles share a posting ID';hold(duplicate,reason,'opening-role',null);hold(job,reason,'opening-role',null);need(false,reason)}
   jobs.push(job);if(!job.country)audit.unknownCountryRoles.push({jobId:job.jobId,title:job.title,country:null,nativeRecord:structuredClone(job.nativeSourceRecord)})
  }
  const close=await transport.read(CAREERS);audit.closingCareers=evidence(close.receipt);let closedPage
  try{closedPage=readCareers(close.receipt.rawText)}catch(error){holdAll(error.message,'closing-careers',audit.closingCareers);throw error}
  audit.closingCareers.nativeRecord=structuredClone(closedPage)
  if(!equivalent(page,closedPage)){
   holdAll('closing publisher identity/context changed','closing-careers',audit.closingCareers);need(false,'closing publisher identity/context changed')}
  for(const job of [...jobs]){
   const row=closedPage.rows.find(r=>r.sourceUrl===job.sourceUrl)
   if(!row||!equivalent(row,job.nativeSourceRecord.listing))hold(job,'closing whole corporate role card changed','closing-careers',audit.closingCareers)
  }
  let closedClient,closedClientRead
  for(const job of [...jobs]){
   const row=closedPage.rows.find(r=>r.sourceUrl===job.sourceUrl),roleRead=await transport.read(job.sourceUrl);let role
   try{role=readRole(roleRead.receipt.rawText,row);need(role.clientURL===client.url,'closing declared client URL changed')}
   catch(error){hold(job,error.message,'closing-role',{rawHTML:roleRead.receipt.rawText});throw error}
   if(!equivalent(job.nativeSourceRecord.role,role)){
    hold(job,'closing whole native role model changed','closing-role',{rawHTML:roleRead.receipt.rawText,rawAPIJSON:null,
     nativeRecord:{listing:structuredClone(row),role:structuredClone(role),api:null,careers:structuredClone(closedPage),client:null}})
    continue
   }
   if(!closedClient){
    closedClientRead=await transport.read(role.clientURL);audit.closingClient=evidence(closedClientRead.receipt)
    try{closedClient=readClient(closedClientRead.receipt.rawText,role.clientURL);need(equivalent(client,closedClient),'closing declared client read/render contract changed')}
    catch(error){holdAll(error.message,'closing-client',audit.closingClient);throw error}
    audit.closingClient.nativeRecord=structuredClone(closedClient)
   }
   const data=await transport.read(apiURL(job.sourceUrl,closedClient));let closed
   const closing={rawHTML:roleRead.receipt.rawText,rawAPIJSON:data.receipt.rawText,nativeRecord:{listing:structuredClone(row),role:structuredClone(role),api:null,careers:structuredClone(closedPage),client:structuredClone(closedClient)}}
   try{closing.nativeRecord.api=JSON.parse(data.receipt.rawText);closed=makeJob(data.receipt.rawText,row,role,closedPage,closedClient,clock)}catch(error){hold(job,error.message,'closing-role',closing);throw error}
   if(!equivalent(job.nativeSourceRecord,closed.nativeSourceRecord)){hold(job,'closing whole role/API model changed','closing-role',closing);continue}
   job.nativeClosingRecord=structuredClone(closed.nativeSourceRecord);job.nativeRoleClosingReconciled=true;audit.nativeRoleClosingReconciled++
   assign(job,[['sourceClosingRawNativeHTML',roleRead.receipt],['sourceClosingRawNativeCareersHTML',close.receipt],['sourceClosingRawNativeClientJS',closedClientRead.receipt],['sourceClosingRawNativeAPIJSON',data.receipt]])
   if(job.country&&job.sourceNativeCriteriaContainerRetained){job.sourceDetailComplete=true;job.sourceDetailStatus='complete';job.sourceDetailFailureKind=null}
  }
 }catch(error){options.signal?.throwIfAborted();failure=error;audit.failures.push({message:error.message,status:error.status??null,requestUrl:error.requestUrl??null})
  for(const j of jobs){j.sourceDetailComplete=false;j.sourceDetailStatus='partial';if(j.country)j.sourceDetailFailureKind='native-collection-failed'}}
 finally{transport.close()}
 return complete()
}
