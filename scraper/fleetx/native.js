import {setTimeout as delay} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {HOME,need,hash,canonical,readNativePage,readClientRoles,bindNativeRecords} from './nativePage.js'
export const createNativeFleetxScraper=(defaults={})=>({async run(passed={}){
 const options={...defaults,...passed},cap=options.maxJobs??Infinity
 options.signal?.throwIfAborted();need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString()
 const receipts=[],audit={source:'fleetx',observedAt:clock,nativeRecords:0,nativeCardObservations:0,nativeRoleClosingReconciled:0,heldNativeRows:[],failures:[],
  sourceScopeComplete:false,lifecycleCleanupAllowed:false}
 let jobs=[]
 const finish=()=>{
  const returned=jobs.slice(0,cap),observation={...structuredClone(audit),returnedRecords:returned.length,
   unresolved:['native-role-country-unproven','native-whole-criteria-container-unverified','company-recruitment-scope-unverified'],
   nativeInventoryReads:[{kind:'active-careers-owned-client-native-openings',surface:HOME,reportedTotal:audit.nativeRecords}]}
  Object.defineProperty(returned,Symbol.for('jobverify.verified-recruitment-observations'),{value:observation})
  if(returned.length)returned[0].sourceNativeCollectionAudit={...structuredClone(audit),responses:structuredClone(receipts)}
  return attachInventoryEvidence(returned,{status:'coverage-gap',surface:HOME,firstParty:receipts.length>0,listingComplete:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:receipts.length,verifiedAt:clock,reason:'Native cards are partial observations; own country, complete criteria and company scope remain unproven'})
 }
 if(cap===0)return finish()
 const interval=options.minIntervalMs??1000
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'||typeof options.fetchPage==='function'),'invalid source pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const deadline=setTimeout(()=>controller.abort(Error('Fleetx source deadline')),180000),allowed=new Set([HOME]),fetchImpl=options.fetchImpl||globalThis.fetch
 const cancel=value=>{try{Promise.resolve(value?.cancel()).catch(()=>{})}catch{}}
 let bytes=0,last=0
 const read=async(url,kind)=>{
  signal.throwIfAborted();need(allowed.has(url)&&receipts.length<64,'unreviewed URL or request bound')
  const wait=interval-(Date.now()-last);if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last=Date.now()
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal]);let response,reader,listener
  const timer=setTimeout(()=>local.abort(Error('Fleetx request deadline')),20000)
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
  try{return await Promise.race([(async()=>{
   if(typeof options.fetchPage==='function'){
    const page=await options.fetchPage(url,{signal:combined});combined.throwIfAborted()
    if(page?.ok===false)throw Object.assign(Error(page.errorMessage||page.errorName||'Fleetx injected page failed'),{abortRetries:true})
    if(page?.status!==200)throw Object.assign(Error('Fleetx native HTTP '+page?.status),{status:page?.status,requestUrl:url,abortRetries:true})
    need(page.url===url&&typeof page.html==='string','injected response identity/body changed')
    const count=Buffer.byteLength(page.html);bytes+=count;need(count<=4000000&&bytes<=32000000,'native response byte bound')
    receipts.push({url,method:'GET',status:200,bodySHA256:hash(page.html),rawBody:page.html,httpMetadataVerified:false});return page.html
   }
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',headers:{Accept:kind==='html'?'text/html':'application/javascript,text/javascript'},signal:combined})
   if(combined.aborted){cancel(response.body);combined.throwIfAborted()}
   need(response.url===url,'manual response identity changed')
   const receipt={url,method:'GET',status:response.status,bodySHA256:null};receipts.push(receipt)
   if(response.status!==200)throw Object.assign(Error('Fleetx native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   const mime=response.headers.get('content-type')||''
   need(kind==='html'?/^text\/html\b/i.test(mime):/^(?:application|text)\/javascript\b/i.test(mime),'native MIME changed')
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')?.toLowerCase()
   need(length===null||/^\d+$/.test(length)&&Number(length)<=4000000,'advertised native byte bound')
   need(!encoding||['identity','gzip','br','deflate'].includes(encoding),'unreviewed native encoding')
   reader=response.body?.getReader();need(reader,'native response stream missing');const chunks=[];let count=0
   for(;;){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break
    count+=part.value.byteLength;bytes+=part.value.byteLength;need(count<=4000000&&bytes<=32000000,'native response byte bound');chunks.push(Buffer.from(part.value))}
   need(length===null||encoding&&encoding!=='identity'||Number(length)===count,'native body length mismatch')
   const body=Buffer.concat(chunks),text=new TextDecoder('utf-8',{fatal:true}).decode(body);receipt.bodySHA256=hash(body);receipt.rawBody=text;return text
  })(),interrupted])}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);cancel(reader||response?.body)}
 }
 const raw=text=>({rawBody:text,bodySHA256:hash(text)})
 try{
  const html=await read(HOME,'html');audit.openingIndex=raw(html)
  const page=readNativePage(html);audit.openingPageBinding=structuredClone(page.binding);audit.nativeCardObservations=page.cards.length
  for(const url of page.binding.pageScripts)allowed.add(url)
  const opening=[];let own
  for(const url of page.binding.pageScripts){const text=await read(url,'javascript'),records=readClientRoles(text,page.binding.moduleID)
   opening.push({url,text,records});if(records){need(!own,'duplicate owning page module');own={url,text,records}}
  }
  need(own,'own native opening array unavailable');audit.nativeRecords=own.records.length;audit.openingNativeRecords=structuredClone(own.records)
  const bound=bindNativeRecords(page,own.records,{html,clientText:own.text,clientURL:own.url,clock});jobs=bound.jobs
  audit.heldNativeRows.push(...bound.held.map(row=>({...row,phase:'opening-index'})))
  let closingRecords=null,closingOwnText=null
  for(const prior of opening){
   const text=await read(prior.url,'javascript'),previous=jobs
   // Clear prior facts before parsing changed native bytes. Restore only exact
   // current models, so a later read cannot resurrect a known contradiction.
   if(text!==prior.text)jobs=[]
   const records=readClientRoles(text,page.binding.moduleID)
   if(records){jobs=[]
    for(const job of previous){const current=records.filter(row=>row.title===job.title)
     if(current.length===1&&canonical(current[0])===canonical(job.nativeSourceRecord.nativeClientRole))jobs.push(job)
     else audit.heldNativeRows.push({id:job.jobId,title:job.title,phase:'closing-client',reason:'own native closing record changed',
      opening:{...raw(job.sourceRawNativeClient),clientURL:own.url,nativeRecord:structuredClone(job.nativeSourceRecord)},closing:{...raw(text),clientURL:prior.url,nativeRecords:structuredClone(current)}})
    }
   }else if(!prior.records)jobs=previous
   need(Boolean(records)===Boolean(prior.records),'closing owning module changed')
   if(records){closingRecords=records;closingOwnText=text}
  }
  const closingHTML=await read(HOME,'html'),previous=jobs;audit.closingIndex=raw(closingHTML);jobs=[]
  const closingPage=readNativePage(closingHTML)
  need(canonical(closingPage.binding)===canonical(page.binding),'closing native page owner changed')
  audit.closingNativeCardObservations=closingPage.cards.length
  const closed=bindNativeRecords(closingPage,closingRecords,{html:closingHTML,clientText:closingOwnText,clientURL:own.url,clock})
  audit.heldNativeRows.push(...closed.held.map(row=>({...row,phase:'closing-index'})))
  for(const job of previous){const current=closed.jobs.find(row=>row.jobId===job.jobId)
   if(current&&canonical(current.nativeSourceRecord)===canonical(job.nativeSourceRecord)){
    Object.assign(job,{nativeClosingRecord:structuredClone(current.nativeSourceRecord),sourceClosingRawNativeHTML:closingHTML,sourceClosingRawNativeHTMLSHA256:hash(closingHTML),
     sourceClosingRawNativeClient:closingOwnText,sourceClosingRawNativeClientSHA256:hash(closingOwnText),nativeRoleClosingReconciled:true});jobs.push(job)
   }else audit.heldNativeRows.push({id:job.jobId,title:job.title,phase:'closing-index',reason:'closing visible native model changed',
    opening:{nativeRecord:structuredClone(job.nativeSourceRecord),indexSHA256:hash(html)},closing:{nativeRecord:current?.nativeSourceRecord??null,indexSHA256:hash(closingHTML)}})
  }
  audit.nativeRoleClosingReconciled=jobs.length
  await options.onAudit?.({...structuredClone(audit),receipts:structuredClone(receipts)})
  options.signal?.throwIfAborted();return finish()
 }catch(error){
  options.signal?.throwIfAborted();audit.failures.push({stage:'native-read',status:error.status??null,message:error.message})
  if(jobs.length){for(const job of jobs)job.nativeRoleClosingReconciled=false;audit.nativeRoleClosingReconciled=0;return finish()}
  Object.assign(error,{source:'fleetx',abortRetries:true,failureKind:'incomplete_listing',recruitmentObservations:{...audit,responses:receipts},
   inventoryEvidence:{status:'coverage-gap',surface:HOME,firstParty:receipts.length>0,listingComplete:false,reportedTotal:null,reason:error.message,verifiedAt:clock}})
  throw error
 }finally{clearTimeout(deadline)}
}})
