import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,BOARD,SEARCH,SOURCE,need,equivalent,comparisonContext,comparisonRow,readCorporate,readBoard,readListing,readRole,makeJob} from './nativeModels.js'
import {createMannHummelPublicRead} from './publicRead.js'
export async function runMannHummelNative(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchBinary&&!options.fetchJson,'HTTP response metadata required');need(options.maxPages==null,'unsupported page cap')
 const cap=options.maxJobs??Infinity;need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),receipts=[]
 const audit={source:SOURCE,observedAt:clock,nativeRecords:null,nativeRoleClosingReconciled:0,heldNativeRows:[],unknownCountryRoles:[],failures:[],complete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 let jobs=[],failure
 const finish=()=>{const result=jobs.slice(0,cap),observation={...structuredClone(audit),responses:structuredClone(receipts),returnedRecords:result.length,
  unresolved:['company-recruitment-scope-unverified',...(audit.unknownCountryRoles.length?['native-role-country-unproven']:[]),...(cap!==Infinity?['caller-result-limit']:[])]}
  Object.defineProperty(result,Symbol.for('jobverify.verified-recruitment-observations'),{value:observation})
  if(audit.nativeRecords!==null)attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeRecords,observedVacancyCount:audit.nativeRecords,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(result.length)result[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:CAREERS,firstParty:Boolean(audit.opening),listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,
   reason:'Paired current corporate/GET search and complete own typed role models with labelled native Country/Region/country properties; company scope and cleanup unqualified'})}
 const complete=async()=>{const result=finish();options.signal?.throwIfAborted();if(options.onAudit){let listener;const cancelled=new Promise((_,reject)=>{listener=()=>reject(options.signal.reason);options.signal?.addEventListener('abort',listener,{once:true})});try{await Promise.race([Promise.resolve().then(()=>options.onAudit(result[Symbol.for('jobverify.verified-recruitment-observations')])),cancelled])}finally{options.signal?.removeEventListener('abort',listener)}}options.signal?.throwIfAborted();if(failure&&!jobs.length)throw Object.assign(failure,{recruitmentObservations:result[Symbol.for('jobverify.verified-recruitment-observations')],inventoryEvidence:readInventoryEvidence(result)});return result}
 if(cap===0)return complete()
 const transport=createMannHummelPublicRead(options,receipts)
 const context=async()=>{const publisher=await transport.read(CAREERS),corporate=readCorporate(publisher.receipt.rawText);transport.allow(corporate.board);const search=await transport.read(BOARD),board=readBoard(search.receipt.rawText);need(board.form.derivedURL===SEARCH,'declared search encoding changed');transport.allow(board.form.derivedURL);const result=await transport.read(SEARCH),listing=readListing(result.receipt.rawText);return {corporate,board,listing,originals:{corporate:publisher.receipt,board:search.receipt,listing:result.receipt}}}
 const assign=(job,ctx,role,prefix='source')=>{for(const [suffix,q]of Object.entries({...ctx.originals,role})){job[prefix+'RawNative'+suffix[0].toUpperCase()+suffix.slice(1)]=q.rawText;job[prefix+'RawNative'+suffix[0].toUpperCase()+suffix.slice(1)+'SHA256']=q.bodySHA256}}
 const hold=(job,reason,closing)=>{jobs=jobs.filter(j=>j!==job);audit.heldNativeRows.push({sourceUrl:job.sourceUrl,title:job.title,reason,opening:{nativeRecord:structuredClone(job.nativeSourceRecord),rawText:job.sourceRawNativeRole},closing:structuredClone(closing)})}
 try{
  const first=await context();audit.opening=structuredClone(first);audit.nativeRecords=first.listing.rows.length
  for(const row of first.listing.rows){transport.allow(row.sourceUrl);const read=await transport.read(row.sourceUrl),role=readRole(read.receipt.rawText,row),job=makeJob(row,role,first.corporate,first.board,first.listing,clock);assign(job,first,read.receipt)
   if(job.nativeExpired||job.postedAt>clock){audit.heldNativeRows.push({sourceUrl:row.sourceUrl,title:row.title,reason:job.nativeExpired?'native-expiry-passed':'native-publication-in-future',opening:{nativeRecord:structuredClone(job.nativeSourceRecord),rawText:read.receipt.rawText}});continue}
   jobs.push(job);if(!job.country)audit.unknownCountryRoles.push({sourceUrl:job.sourceUrl,title:job.title,reason:'native-country-unproven'})
  }
  let closed;try{closed=await context();audit.closing=structuredClone(closed);need(equivalent(comparisonContext(first),comparisonContext(closed)),'closing corporate/search context changed')}catch(error){for(const job of [...jobs])hold(job,error.message,audit.closing||null);throw error}
  for(const row of closed.listing.rows){const read=await transport.read(row.sourceUrl),job=jobs.find(j=>j.sourceUrl===row.sourceUrl);let role
   try{role=readRole(read.receipt.rawText,row)}catch(error){if(job)hold(job,error.message,{rawText:read.receipt.rawText});throw error}
   if(!job)continue
   if(!equivalent(job.nativeSourceRecord.role,role)){hold(job,'closing whole role model changed',{role,rawText:read.receipt.rawText});continue}
   const closing=makeJob(row,role,closed.corporate,closed.board,closed.listing,clock);need(equivalent(comparisonRow(job.nativeSourceRecord.listing),comparisonRow(closing.nativeSourceRecord.listing)),'closing native model differs')
   job.nativeClosingRecord=structuredClone(closing.nativeSourceRecord);job.nativeRoleClosingReconciled=true;assign(job,closed,read.receipt,'sourceClosing');audit.nativeRoleClosingReconciled++
   if(job.country){job.sourceDetailComplete=true;job.sourceDetailStatus='complete';job.sourceDetailFailureKind=null}
  }
 }catch(error){options.signal?.throwIfAborted();failure=error;audit.failures.push({message:error.message,status:error.status??null,requestUrl:error.requestUrl??null});for(const job of jobs){job.sourceDetailComplete=false;job.sourceDetailStatus='partial';if(job.country)job.sourceDetailFailureKind='native-collection-failed'}}finally{transport.close()}
 return complete()
}
