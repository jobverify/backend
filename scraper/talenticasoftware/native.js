import {setTimeout as delay} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {HOME,need,hash,canonical,readNativeIndex,readNativeRole} from './nativeRole.js'
export const createNativeTalenticaScraper=(defaults={})=>({async run(passed={}){
 const options={...defaults,...passed},cap=options.maxJobs??Infinity
 options.signal?.throwIfAborted();need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString()
 const receipts=[],audit={source:'talenticasoftware',observedAt:clock,nativeRecords:0,nativeRoleClosingReconciled:0,heldNativeRows:[],failures:[],sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 let jobs=[]
 const finish=()=>{
  const result=jobs.slice(0,cap)
  Object.defineProperty(result,Symbol.for('jobverify.verified-recruitment-observations'),{value:{...structuredClone(audit),returnedRecords:result.length,
   unresolved:['native-role-country-unproven','company-recruitment-scope-unverified'],
   nativeInventoryReads:[{kind:'active-company-index-and-whole-native-role-containers',surface:HOME,reportedTotal:audit.nativeRecords}]}})
  if(result.length)result[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(result,{status:'coverage-gap',surface:HOME,firstParty:receipts.length>0,listingComplete:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:receipts.length,verifiedAt:clock,reason:'Whole native role content retained; native work-country and company recruitment scope remain unproven'})
 }
 if(cap===0)return finish()
 const interval=options.minIntervalMs??1000
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'||typeof options.fetchText==='function'),'invalid source pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const deadline=setTimeout(()=>controller.abort(Error('Talentica source deadline')),180000),allowed=new Set([HOME]),fetchImpl=options.fetchImpl||globalThis.fetch
 const cancel=value=>{try{Promise.resolve(value?.cancel()).catch(()=>{})}catch{}}
 let bytes=0,last=0
 const read=async url=>{
  signal.throwIfAborted();need(allowed.has(url)&&receipts.length<64,'unreviewed URL or request bound')
  const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last=Date.now()
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]);let response,reader,listener
  const timer=setTimeout(()=>local.abort(Error('Talentica request deadline')),20000)
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
  try{return await Promise.race([(async()=>{
   if(typeof options.fetchText==='function'){
    const text=await options.fetchText(url,{signal:combined});combined.throwIfAborted();need(typeof text==='string','invalid injected body')
    const count=Buffer.byteLength(text);bytes+=count;need(count<=4000000&&bytes<=32000000,'native response byte bound')
    receipts.push({url,method:'GET',status:null,bodySHA256:hash(text),rawHTML:text,httpMetadataVerified:false});return text
   }
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:'text/html'},signal:combined})
   if(combined.aborted){cancel(response.body);combined.throwIfAborted()}
   need(response.url===url,'manual response identity changed')
   const receipt={url,method:'GET',status:response.status,bodySHA256:null};receipts.push(receipt)
   if(response.status!==200)throw Object.assign(Error('Talentica native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   need(/^text\/html\b/i.test(response.headers.get('content-type')||''),'native MIME changed')
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')?.toLowerCase()
   need(length===null||/^\d+$/.test(length)&&Number(length)<=4000000,'advertised native byte bound')
   need(!encoding||['identity','gzip','br','deflate'].includes(encoding),'unreviewed native encoding')
   reader=response.body?.getReader();need(reader,'native response stream missing');const chunks=[];let count=0
   for(;;){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break
    count+=part.value.byteLength;bytes+=part.value.byteLength;need(count<=4000000&&bytes<=32000000,'native response byte bound');chunks.push(Buffer.from(part.value))}
   need(length===null||encoding&&encoding!=='identity'||Number(length)===count,'native body length mismatch')
   const body=Buffer.concat(chunks),text=new TextDecoder('utf8',{fatal:true}).decode(body);receipt.bodySHA256=hash(body);receipt.rawHTML=text;return text
  })(),interrupted])}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);cancel(reader||response?.body)}
 }
 const raw=(html,nativeRecord=null)=>({rawHTML:html,bodySHA256:hash(html),nativeRecord:structuredClone(nativeRecord)})
 const groups=rows=>{const map=new Map();for(const row of rows){if(!map.has(row.sourceUrl))map.set(row.sourceUrl,[]);map.get(row.sourceUrl).push(row)}return map}
 const held=(listing,error,phase,evidence)=>audit.heldNativeRows.push({sourceUrl:listing.sourceUrl,jobId:listing.jobId,reason:error.message,phase,...evidence})
 try{
  const html=await read(HOME);audit.openingIndex=raw(html);const opening=readNativeIndex(html),start=groups(opening.rows)
  audit.openingIndex.nativeRecord=structuredClone(opening);audit.nativeRecords=start.size;audit.nativeCardObservations=opening.rows.length
  const eligible=[]
  for(const rows of start.values()){
   const listing=rows[0]
   if(!rows.every(row=>canonical(row.nativeListing)===canonical(listing.nativeListing))){held(listing,Error('conflicting duplicate native listing'),'opening-index',{listings:rows.map(r=>structuredClone(r.nativeListing))});continue}
   allowed.add(listing.sourceUrl);eligible.push(listing);const roleHTML=await read(listing.sourceUrl)
   try{jobs.push(readNativeRole(listing,roleHTML,clock))}catch(error){held(listing,error,'opening-role',{opening:raw(roleHTML),listing:structuredClone(listing.nativeListing)})}
  }
  for(const job of [...jobs]){
   const roleHTML=await read(job.sourceUrl),listing=eligible.find(r=>r.sourceUrl===job.sourceUrl);let current
   try{
    current=readNativeRole(listing,roleHTML,clock);need(canonical(current.nativeSourceRecord)===canonical(job.nativeSourceRecord),'closing whole own-role model changed')
    job.nativeClosingRecord=structuredClone(current.nativeSourceRecord);job.sourceClosingRawNativeHTML=roleHTML;job.sourceClosingRawNativeHTMLSHA256=hash(roleHTML)
   }catch(error){held(job,error,'closing-role',{opening:raw(job.sourceRawNativeHTML,job.nativeSourceRecord),closing:raw(roleHTML,current?.nativeSourceRecord)});jobs=jobs.filter(j=>j!==job)}
  }
  const closingHTML=await read(HOME),previous=jobs;audit.closingIndex=raw(closingHTML);jobs=[]
  let closing
  try{closing=readNativeIndex(closingHTML)}catch(error){
   for(const job of previous)held(job,error,'closing-index',{opening:raw(job.sourceRawNativeHTML,job.nativeSourceRecord),
    closing:raw(job.sourceClosingRawNativeHTML,job.nativeClosingRecord),indexSHA256:hash(closingHTML)})
   throw error
  }
  const end=groups(closing.rows);audit.closingIndex.nativeRecord=structuredClone(closing)
  for(const job of previous){const rows=end.get(job.sourceUrl)||[]
   if(rows.length&&rows.every(r=>canonical(r.nativeListing)===canonical(job.nativeSourceRecord.listing)))jobs.push(job)
   else held(job,Error('closing native listing changed or duplicated'),'closing-index',{opening:raw(job.sourceRawNativeHTML,job.nativeSourceRecord),
    closing:raw(job.sourceClosingRawNativeHTML,job.nativeClosingRecord),listings:rows.map(r=>structuredClone(r.nativeListing))})
  }
  for(const job of jobs)job.nativeRoleClosingReconciled=true
  audit.nativeRoleClosingReconciled=jobs.length;options.signal?.throwIfAborted();await options.onAudit?.(structuredClone(audit));options.signal?.throwIfAborted();return finish()
 }catch(error){
  options.signal?.throwIfAborted();audit.failures.push({status:error.status??null,message:error.message})
  for(const job of jobs)job.nativeRoleClosingReconciled=false;audit.nativeRoleClosingReconciled=0
  if(jobs.length)return finish()
  Object.assign(error,{source:'talenticasoftware',abortRetries:true,failureKind:'incomplete_listing',recruitmentObservations:{...audit,responses:receipts},
   inventoryEvidence:{status:'coverage-gap',surface:HOME,firstParty:receipts.length>0,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:clock,reason:error.message}})
  throw error
 }finally{clearTimeout(deadline)}
}})
