import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CAREERS,JOBS,INDIA,SOURCE,need,readPublisher,readClient,readListing,readRole,makeJob,equivalent} from './nativeModels.js'
import {createAdidasPublicRead} from './publicRead.js'
export async function runAdidasNative(options={}){
 options.signal?.throwIfAborted();need(!options.fetchText&&!options.fetchPage&&!options.fetchBinary&&!options.fetchJson,'HTTP response metadata required');need(options.maxPages==null,'unsupported page cap')
 const cap=options.maxJobs??Infinity;need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString(),receipts=[]
 const audit={source:SOURCE,observedAt:clock,nativeRecords:null,nativeRoleClosingReconciled:0,heldNativeRows:[],unknownCountryRoles:[],failures:[],complete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 let jobs=[],failure
 const finish=()=>{const result=jobs.slice(0,cap),observation={...structuredClone(audit),responses:structuredClone(receipts),returnedRecords:result.length,unresolved:['company-recruitment-scope-unverified',...(audit.unknownCountryRoles.length?['native-role-country-unproven']:[]),...(cap!==Infinity?['caller-result-limit']:[])]}
  Object.defineProperty(result,Symbol.for('jobverify.verified-recruitment-observations'),{value:observation})
  if(audit.nativeRecords!==null)attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeRecords,observedVacancyCount:audit.nativeRecords-audit.talentPoolRecords,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  if(result.length)result[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:CAREERS,firstParty:Boolean(audit.opening),listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,reason:'Paired current declared public GET search and complete own RMK role models with literal Country/Region and own brand evidence; company scope and cleanup unqualified'})}
 const complete=async()=>{const result=finish();options.signal?.throwIfAborted();if(options.onAudit){let abort;const cancelled=new Promise((_,reject)=>{abort=()=>reject(options.signal.reason);options.signal?.addEventListener('abort',abort,{once:true})});try{await Promise.race([Promise.resolve().then(()=>options.onAudit(result[Symbol.for('jobverify.verified-recruitment-observations')])),cancelled])}finally{options.signal?.removeEventListener('abort',abort)}}options.signal?.throwIfAborted();if(failure&&!jobs.length)throw Object.assign(failure,{recruitmentObservations:result[Symbol.for('jobverify.verified-recruitment-observations')],inventoryEvidence:readInventoryEvidence(result)});return result}
 if(cap===0)return complete()
 const transport=createAdidasPublicRead(options,receipts)
 const context=async()=>{const home=await transport.read(CAREERS),publisher=readPublisher(home.receipt.rawText);transport.allow(JOBS);const search=await transport.read(JOBS),index=readPublisher(search.receipt.rawText,{index:true});need(publisher.client===index.client,'declared client differs');transport.allow(index.client);const program=await transport.read(index.client),client=readClient(program.receipt.rawText);transport.allow(client.derivedURL);const page=await transport.read(INDIA),listing=readListing(page.receipt.rawText);return {publisher,index,client,listing,originals:{publisher:home.receipt,index:search.receipt,client:program.receipt,listing:page.receipt}}}
 const assign=(job,ctx,role,prefix='source')=>{for(const [suffix,r]of Object.entries({...ctx.originals,role})){job[prefix+'RawNative'+suffix[0].toUpperCase()+suffix.slice(1)]=r.rawText;job[prefix+'RawNative'+suffix[0].toUpperCase()+suffix.slice(1)+'SHA256']=r.bodySHA256}}
 const hold=(job,reason,closing)=>{jobs=jobs.filter(j=>j!==job);audit.heldNativeRows.push({sourceUrl:job.sourceUrl,title:job.title,reason,opening:{nativeRecord:structuredClone(job.nativeSourceRecord),rawText:job.sourceRawNativeRole},closing:structuredClone(closing)})}
 try{
  const first=await context();audit.opening=structuredClone(first);audit.nativeRecords=first.listing.rows.length;audit.talentPoolRecords=0
  for(const row of first.listing.rows){transport.allow(row.requestedURL);const read=await transport.read(row.requestedURL),role=readRole(read.receipt.rawText,row)
   if(/\btalent pool\b/i.test(row.title)){audit.talentPoolRecords++;audit.heldNativeRows.push({reason:'talent-pool',sourceUrl:row.sourceUrl,title:row.title,opening:{role,rawText:read.receipt.rawText}});continue}
   const job=makeJob(row,role,first.publisher,first.index,first.client,first.listing,clock);assign(job,first,read.receipt);jobs.push(job);if(!job.country)audit.unknownCountryRoles.push({sourceUrl:job.sourceUrl,title:job.title})
  }
  let closed;try{closed=await context();audit.closing=structuredClone(closed);need(equivalent({...first,originals:null},{...closed,originals:null}),'closing publisher/listing context changed')}catch(error){for(const job of [...jobs])hold(job,error.message,audit.closing||null);throw error}
  for(const row of closed.listing.rows){const roleRead=await transport.read(row.requestedURL),job=jobs.find(j=>j.sourceUrl===row.sourceUrl);let role
   try{role=readRole(roleRead.receipt.rawText,row)}catch(error){if(job)hold(job,error.message,{rawText:roleRead.receipt.rawText});throw error}
   if(!job)continue
   if(!equivalent(job.nativeSourceRecord.role,role)){hold(job,'closing whole role model changed',{role,rawText:roleRead.receipt.rawText});continue}
   const closing=makeJob(row,role,closed.publisher,closed.index,closed.client,closed.listing,clock);need(equivalent(job.nativeSourceRecord,closing.nativeSourceRecord),'closing native model differs')
   job.nativeClosingRecord=structuredClone(closing.nativeSourceRecord);job.nativeRoleClosingReconciled=true;assign(job,closed,roleRead.receipt,'sourceClosing');audit.nativeRoleClosingReconciled++
   if(job.country){job.sourceDetailComplete=true;job.sourceDetailStatus='complete';job.sourceDetailFailureKind=null}
  }
 }catch(error){options.signal?.throwIfAborted();failure=error;audit.failures.push({message:error.message,status:error.status??null,requestUrl:error.requestUrl??null});for(const job of jobs){job.sourceDetailComplete=false;job.sourceDetailStatus='partial';if(job.country)job.sourceDetailFailureKind='native-collection-failed'}}finally{transport.close()}
 return complete()
}
