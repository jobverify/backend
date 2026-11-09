import {setTimeout as delay} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {HOME,need,hash,canonical,extractJobCards,readNativeRole} from './nativeRole.js'
export const createCyraacScraper=(defaults={})=>({async run(passed={}){
 const options={...defaults,...passed},cap=options.maxJobs??Infinity
 options.signal?.throwIfAborted();need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString()
 const receipts=[],audit={source:'cyraac',observedAt:clock,nativeRecords:0,nativeRoleClosingReconciled:0,failures:[],heldNativeRows:[],sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 const finish=jobs=>{
  Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:{...structuredClone(audit),returnedRecords:jobs.length,
   unresolved:['company-recruitment-scope-unverified','native-whole-criteria-container-unverified',...(jobs.some(j=>j.country===null)?['native-role-country-unproven']:[])],
   nativeInventoryReads:[{kind:'own-current-careers-and-role-pages',surface:HOME,reportedTotal:audit.nativeRecords}]}})
  if(jobs.length)jobs[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOME,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:receipts.length,verifiedAt:clock,reason:'Native records retain unproven country or whole-criteria scope; company completeness and cleanup remain unqualified'})
 }
 if(cap===0)return finish([])
 const interval=options.minIntervalMs??1000
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'||typeof options.fetchText==='function'),'invalid source pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const deadline=setTimeout(()=>controller.abort(Error('CYRAACS source deadline')),180000),allowed=new Set([HOME])
 const fetchImpl=options.fetchImpl||globalThis.fetch,cancelQuietly=value=>{try{Promise.resolve(value?.cancel()).catch(()=>{})}catch{}}
 let bytes=0,last=0,jobs=[]
 const read=async url=>{
  signal.throwIfAborted();need(allowed.has(url)&&receipts.length<64,'unreviewed request URL or request bound')
  const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last=Date.now()
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]);let response,reader,listener
  const timer=setTimeout(()=>local.abort(Error('CYRAACS request deadline')),20000)
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
  try{return await Promise.race([(async()=>{
   if(typeof options.fetchText==='function'){
    const text=await options.fetchText(url,{signal:combined});combined.throwIfAborted();need(typeof text==='string','invalid injected body')
    const count=Buffer.byteLength(text);bytes+=count;need(count<=4000000&&bytes<=32000000,'native response byte bound')
    receipts.push({url,method:'GET',status:null,bodySHA256:hash(text),httpMetadataVerified:false});return text
   }
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:'text/html'},signal:combined})
   if(combined.aborted){cancelQuietly(response.body);combined.throwIfAborted()}
   need(response.url===url,'manual response identity changed')
   const receipt={url,method:'GET',status:response.status,bodySHA256:null};receipts.push(receipt)
   if(response.status!==200)throw Object.assign(Error('CYRAACS native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   need(/^text\/html\b/i.test(response.headers.get('content-type')||''),'unexpected native MIME')
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')?.toLowerCase()
   need(length===null||/^\d+$/.test(length)&&Number(length)<=4000000,'advertised native response bound')
   need(!encoding||['identity','gzip','br','deflate'].includes(encoding.toLowerCase()),'unreviewed native encoding')
   reader=response.body?.getReader();need(reader,'native response stream missing')
   const chunks=[];let count=0
   for(;;){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break
    count+=part.value.byteLength;bytes+=part.value.byteLength;need(count<=4000000&&bytes<=32000000,'native response byte bound');chunks.push(Buffer.from(part.value))}
   need(length===null||encoding&&encoding!=='identity'||Number(length)===count,'native body length mismatch')
   const body=Buffer.concat(chunks);receipt.bodySHA256=hash(body);return new TextDecoder('utf-8',{fatal:true}).decode(body)
  })(),interrupted])}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);cancelQuietly(reader||response?.body)}
 }
 const held=(id,error,evidence={})=>audit.heldNativeRows.push({id,reason:error.message,...evidence})
 const rawEvidence=(html,model=null)=>({rawHTML:html,bodySHA256:hash(html),nativeRecord:model?structuredClone(model):null})
 const groupRows=rows=>{const groups=new Map();for(const row of rows){if(!groups.has(row.jobId))groups.set(row.jobId,[]);groups.get(row.jobId).push(row)}return groups}
 const pairedEvidence=job=>({opening:rawEvidence(job.sourceRawNativeHTML,job.nativeSourceRecord),closing:rawEvidence(job.sourceClosingRawNativeHTML,job.nativeClosingRecord)})
 try{
  const openingHTML=await read(HOME);audit.openingIndex=rawEvidence(openingHTML)
  const opening=extractJobCards(openingHTML),openingGroups=groupRows(opening)
  audit.openingIndex.nativeRecord=opening.map(row=>structuredClone(row.sourceNativeListingRecord))
  need(opening.length>0,'current native role index unavailable');audit.nativeRecords=openingGroups.size;audit.nativeCardObservations=opening.length
  for(const [id,rows] of openingGroups){const listing=rows[0]
   if(!rows.every(row=>canonical(row.sourceNativeListingRecord)===canonical(listing.sourceNativeListingRecord))){held(id,Error('conflicting duplicate native opening key'),{phase:'opening-index',listings:rows.map(row=>structuredClone(row.sourceNativeListingRecord)),indexSHA256:hash(openingHTML)});continue}
   allowed.add(listing.sourceUrl);const html=await read(listing.sourceUrl)
   try{jobs.push(readNativeRole(listing,html,clock))}catch(error){held(listing.jobId,error,{phase:'opening-role',opening:rawEvidence(html),listing:structuredClone(listing.sourceNativeListingRecord)})}
  }
  for(const job of [...jobs]){
   const html=await read(job.sourceUrl);let current
   try{current=readNativeRole(opening.find(r=>r.jobId===job.jobId),html,clock)
    need(canonical(current.nativeSourceRecord)===canonical(job.nativeSourceRecord),'closing own native role model changed')
    job.nativeClosingRecord=structuredClone(current.nativeSourceRecord);job.sourceClosingRawNativeHTML=html;job.sourceClosingRawNativeHTMLSHA256=hash(html)
   }catch(error){held(job.jobId,error,{phase:'closing-role',opening:rawEvidence(job.sourceRawNativeHTML,job.nativeSourceRecord),closing:rawEvidence(html,current?.nativeSourceRecord)});jobs=jobs.filter(j=>j!==job)}
  }
  const closingHTML=await read(HOME),previous=jobs; audit.closingIndex=rawEvidence(closingHTML);jobs=[]
  // A parsed but invalid closing index cannot restore opening models. An HTTP
  // failure above still retains earlier facts with incomplete closing flags.
  let closing
  try{closing=extractJobCards(closingHTML)}catch(error){for(const job of previous)held(job.jobId,error,{phase:'closing-index',...pairedEvidence(job),indexSHA256:hash(closingHTML)});throw error}
  const end=groupRows(closing);audit.closingNativeCardObservations=closing.length
  audit.closingIndex.nativeRecord=closing.map(row=>structuredClone(row.sourceNativeListingRecord))
  for(const job of previous){const rows=end.get(job.jobId)||[]
   if(rows.length&&rows.every(row=>canonical(row.sourceNativeListingRecord)===canonical(job.nativeSourceRecord.listing)))jobs.push(job)
   else held(job.jobId,Error('closing native listing changed or duplicated'),{phase:'closing-index',...pairedEvidence(job),
    listings:rows.map(r=>structuredClone(r.sourceNativeListingRecord)),indexSHA256:hash(closingHTML)})
  }
  for(const job of jobs)job.nativeRoleClosingReconciled=true
  audit.nativeRoleClosingReconciled=jobs.length
  await options.onAudit?.({...structuredClone(audit),receipts:structuredClone(receipts)})
  options.signal?.throwIfAborted();return finish(jobs.slice(0,cap))
 }catch(error){
  options.signal?.throwIfAborted();audit.failures.push({stage:'own-native-read',status:error.status??null,message:error.message})
  if(jobs.length){for(const job of jobs)job.nativeRoleClosingReconciled=false;audit.nativeRoleClosingReconciled=0;return finish(jobs.slice(0,cap))}
  Object.assign(error,{source:'cyraac',abortRetries:true,failureKind:'incomplete_listing',recruitmentObservations:audit,
   inventoryEvidence:{status:'coverage-gap',surface:HOME,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:clock,reason:error.message}})
  throw error
 }finally{clearTimeout(deadline)}
}})
