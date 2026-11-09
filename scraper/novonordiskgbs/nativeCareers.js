import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,SOURCE,need,equivalent,readPublisher,readListing,readRole,roleDeadline,makeJob} from './nativeModels.js'
import {createNovoNordiskGbsPublicRead} from './publicRead.js'
export async function runNovoNordiskGbsNative(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchBinary&&!options.fetchJson,'HTTP response metadata required');need(options.maxPages==null,'unsupported page cap')
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
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:CAREERS,firstParty:Boolean(audit.opening),listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,
   reason:'Paired current public GET search and complete own GBS role models; unknown-country roles, company scope and cleanup remain unqualified'})
 }
 const complete=async()=>{const result=finish();options.signal?.throwIfAborted();if(options.onAudit){let listener;const cancelled=new Promise((_,reject)=>{listener=()=>reject(options.signal.reason);options.signal?.addEventListener('abort',listener,{once:true})});try{await Promise.race([Promise.resolve().then(()=>options.onAudit(result[Symbol.for('jobverify.verified-recruitment-observations')])),cancelled])}finally{options.signal?.removeEventListener('abort',listener)}}options.signal?.throwIfAborted();if(failure&&!jobs.length)throw Object.assign(failure,{recruitmentObservations:result[Symbol.for('jobverify.verified-recruitment-observations')],inventoryEvidence:readInventoryEvidence(result)});return result}
 if(cap===0)return complete()
 const transport=createNovoNordiskGbsPublicRead(options,receipts)
 const context=async()=>{
  const home=await transport.read(CAREERS),publisher=readPublisher(home.receipt.rawText);transport.allow(publisher.derivedURL)
  const first=await transport.read(publisher.derivedURL),opening=readListing(first.receipt.rawText,publisher.derivedURL),listings=[opening],originals=[first.receipt]
  need(opening.currentPage===1&&opening.start===1&&opening.declaredPages.length===opening.totalPages-1,'first native page/pagination incomplete')
  for(const url of opening.declaredPages){transport.allow(url);const page=await transport.read(url),listing=readListing(page.receipt.rawText,url);listings.push(listing);originals.push(page.receipt)}
  listings.sort((a,b)=>a.currentPage-b.currentPage)
  for(let i=0;i<listings.length;i++)need(listings[i].currentPage===i+1&&listings[i].total===opening.total&&listings[i].totalPages===opening.totalPages&&(i===0||listings[i].start===listings[i-1].end+1),'native pagination/count reconciliation failed')
  const rows=listings.flatMap(p=>p.rows);need(rows.length===opening.total&&new Set(rows.map(r=>r.sourceUrl)).size===rows.length,'duplicate or missing canonical native rows')
  return {publisher,listings,rows,originals:{publisher:home.receipt,listings:originals}}
 }
 const assign=(job,ctx,role,prefix='source')=>{job[prefix+'RawNativePublisher']=ctx.originals.publisher.rawText;job[prefix+'RawNativePublisherSHA256']=ctx.originals.publisher.bodySHA256;job[prefix+'RawNativeListings']=ctx.originals.listings.map(q=>({url:q.url,rawText:q.rawText,bodySHA256:q.bodySHA256}));job[prefix+'RawNativeRole']=role.rawText;job[prefix+'RawNativeRoleSHA256']=role.bodySHA256}
 const hold=(job,reason,closing)=>{jobs=jobs.filter(j=>j!==job);audit.heldNativeRows.push({sourceUrl:job.sourceUrl,title:job.title,reason,opening:{nativeRecord:structuredClone(job.nativeSourceRecord),rawText:job.sourceRawNativeRole},closing:structuredClone(closing)})}
 const classify=(row,role)=>role.employerScopeConflicts.length?'native-employer-scope-conflict':!role.gbs?'outside-gbs-scope':roleDeadline(role,clock).expired?'published-application-deadline-passed':null
 try{
  const first=await context();audit.opening=structuredClone(first);audit.nativeRecords=first.rows.length
  const initialModels=new Map()
  for(const row of first.rows){transport.allow(row.sourceUrl);const read=await transport.read(row.sourceUrl),role=readRole(read.receipt.rawText,row),reason=classify(row,role);initialModels.set(row.sourceUrl,role)
   if(reason){audit.heldNativeRows.push({sourceUrl:row.sourceUrl,title:row.title,reason,opening:{role,rawText:read.receipt.rawText}});continue}
   const job=makeJob(row,role,first.publisher,first.listings,clock);assign(job,first,read.receipt);jobs.push(job);if(!job.country)audit.unknownCountryRoles.push({sourceUrl:job.sourceUrl,title:job.title,reason:'native-country-unproven'})
  }
  let closed;try{closed=await context();audit.closing=structuredClone(closed);need(equivalent({...first,originals:null},{...closed,originals:null}),'closing publisher/search context changed')}catch(error){for(const job of [...jobs])hold(job,error.message,audit.closing||null);throw error}
  for(const row of closed.rows){const read=await transport.read(row.sourceUrl),job=jobs.find(j=>j.sourceUrl===row.sourceUrl);let role
   try{role=readRole(read.receipt.rawText,row)}catch(error){if(job)hold(job,error.message,{rawText:read.receipt.rawText});throw error}
   if(!equivalent(initialModels.get(row.sourceUrl),role)){if(job)hold(job,'closing whole role model changed',{role,rawText:read.receipt.rawText});else audit.heldNativeRows.push({sourceUrl:row.sourceUrl,title:row.title,reason:'closing excluded role model changed',closing:{role,rawText:read.receipt.rawText}});continue}
   if(!job)continue
   const closing=makeJob(row,role,closed.publisher,closed.listings,clock);need(equivalent(job.nativeSourceRecord,closing.nativeSourceRecord),'closing native model differs')
   job.nativeClosingRecord=structuredClone(closing.nativeSourceRecord);job.nativeRoleClosingReconciled=true;assign(job,closed,read.receipt,'sourceClosing');audit.nativeRoleClosingReconciled++
   if(job.country){job.sourceDetailComplete=true;job.sourceDetailStatus='complete';job.sourceDetailFailureKind=null}
  }
 }catch(error){options.signal?.throwIfAborted();failure=error;audit.failures.push({message:error.message,status:error.status??null,requestUrl:error.requestUrl??null});for(const job of jobs){job.sourceDetailComplete=false;job.sourceDetailStatus='partial';if(job.country)job.sourceDetailFailureKind='native-collection-failed'}}finally{transport.close()}
 return complete()
}
