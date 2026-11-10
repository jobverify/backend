import {setTimeout as delay} from 'node:timers/promises'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {SOURCE,HOME,INDEX,API,HOST,canonical,need,parsed,hash,copy,corporateHome,indexRedirect,corporateIndex,corporateRole,nativePosting,readNativeRole} from './nativeRole.js'

export const createNativeLyraScraper=(defaults={})=>({async run(passed={}){
 const options={...defaults,...passed},cap=options.maxJobs??Infinity
 options.signal?.throwIfAborted()
 need(cap===Infinity||Number.isSafeInteger(cap)&&cap>=0,'invalid result cap')
 const clock=new Date(typeof options.now==='function'?options.now():options.now??Date.now()).toISOString()
 const audit={source:SOURCE,observedAt:clock,nativeRecords:0,openingPages:0,closingPages:0,nativeRoleClosingReconciled:0,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,heldNativeRows:[],failures:[]},receipts=[]
 const finish=jobs=>{
  Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:{...audit,returnedIndiaJobs:jobs.length,
   unresolved:['company-recruitment-scope-unverified',...audit.failures.map(f=>f.message)],
   nativeInventoryReads:[{kind:'public-paginated-lever',surface:API,reportedTotal:audit.nativeRecords}]}})
  if(jobs.length)jobs[0].sourceNativeCollectionAudit={...copy(audit),responses:copy(receipts)}
  if(audit.nativeRecords>0)attachSourceObservationEvidence(jobs,{
   source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:audit.nativeRecords,
   observedVacancyCount:audit.nativeRecords,sourceScopeComplete:false,
  })
  const heldReasons=[...new Set(audit.heldNativeRows.map(row=>String(row.reason).slice(0,320)))].slice(0,3)
  const holds=audit.heldNativeRows.length?'; held-native-roles='+audit.heldNativeRows.length+'; hold-reasons='+heldReasons.join(' | '):''
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:HOME,firstParty:true,listingComplete:false,
   reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,
   reason:'Full current own role models reconciled='+audit.nativeRoleClosingReconciled+holds+'; company recruitment scope and cleanup remain unqualified'})
 }
 if(cap===0)return finish([])
 const interval=options.minIntervalMs??1000
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000&&(interval>=1000||typeof options.fetchImpl==='function'),'invalid source pacing')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const deadline=setTimeout(()=>controller.abort(Object.assign(Error('Lyra source deadline'),{code:'LYRA_NATIVE_DEADLINE'})),180000)
 const fetchImpl=options.fetchImpl||globalThis.fetch,allowed=new Set([HOME,INDEX]),last=new Map()
 let totalBytes=0,jobs=[]
 const cancelQuietly=stream=>{try{Promise.resolve(stream?.cancel()).catch(()=>{})}catch{}}
 const read=async url=>{
  signal.throwIfAborted();need(allowed.has(url)&&receipts.length<64,'unreviewed source URL or request bound')
  const origin=new URL(url).origin,wait=interval-(Date.now()-(last.get(origin)||0))
  if(wait>0)await delay(wait,undefined,{signal});signal.throwIfAborted();last.set(origin,Date.now())
  const local=new AbortController(),combined=AbortSignal.any([signal,local.signal])
  let listener,response,reader
  const timer=setTimeout(()=>local.abort(Object.assign(Error('Lyra request deadline'),{code:'LYRA_NATIVE_REQUEST_DEADLINE'})),20000)
  const interrupted=new Promise((_,reject)=>{listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})})
  try{return await Promise.race([(async()=>{
   response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'manual',signal:combined,
    headers:{Accept:url.startsWith(API)?'application/json':'text/html'}})
   if(combined.aborted){cancelQuietly(response.body);combined.throwIfAborted()}
   combined.throwIfAborted();need(response.url===url,'manual response identity changed')
   const receipt={url,method:'GET',status:response.status,sha256:null};receipts.push(receipt)
   if(response.status!==200&&!(url===INDEX&&response.status===302))throw Object.assign(Error('Lyra native HTTP '+response.status),{status:response.status,requestUrl:url,abortRetries:true})
   const mime=response.headers.get('content-type')||'',advertised=response.headers.get('content-length'),encoding=response.headers.get('content-encoding')
   need(response.status===302||(url.startsWith(API)?/^application\/json\b/i:/^text\/html\b/i).test(mime),'unexpected native response MIME')
   need(advertised===null||/^\d+$/.test(advertised)&&Number(advertised)<=4000000,'advertised native body bound')
   need(!encoding||['identity','gzip','br','deflate'].includes(encoding.toLowerCase()),'unsupported native response encoding')
   reader=response.body?.getReader();need(reader||response.status===302&&advertised==='0','native response stream missing')
   const chunks=[];let count=0
   while(reader){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break
    count+=part.value.byteLength;totalBytes+=part.value.byteLength;need(count<=4000000&&totalBytes<=32000000,'native response byte bound');chunks.push(Buffer.from(part.value))}
   need(advertised===null||encoding&&encoding!=='identity'||Number(advertised)===count,'native body length mismatch')
   const bytes=Buffer.concat(chunks);receipt.sha256=hash(bytes)
   return {url,status:response.status,location:response.headers.get('location'),text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),bodySHA256:receipt.sha256}
  })(),interrupted])}finally{
   clearTimeout(timer);combined.removeEventListener('abort',listener)
   cancelQuietly(reader||response?.body)
  }
 }
 const publisher=async()=>{
  const home=corporateHome((await read(HOME)).text),entry=await read(INDEX)
  let indexPage=entry
  if(entry.status===302){const target=indexRedirect(entry.location);allowed.add(target);indexPage=await read(target)}
  const index=corporateIndex(indexPage.text,indexPage.url);allowed.add(index.roleURL)
  const role=corporateRole((await read(index.roleURL)).text,index.roleURL)
  return {home,index,role}
 }
 const inventory=async phase=>{
  const rows=[],ids=new Set()
  for(let skip=0;skip<2000;skip+=50){
   const url=API+'?mode=json&skip='+skip+'&limit=50';allowed.add(url)
   const page=parsed((await read(url)).text)
   if(phase==='closing'&&Array.isArray(page)){
    // Scan the entire already-observed page before any shape/identity check
    // can throw on an earlier row and hide a later contradiction.
    const counts=new Map()
    for(const row of page)counts.set(row?.id,(counts.get(row?.id)||0)+1)
    jobs=jobs.filter(job=>{
     const seen=page.filter(row=>row?.id===job.jobId)
     const changed=seen.length&&(ids.has(job.jobId)||counts.get(job.jobId)>1||seen.some(row=>canonical(row)!==canonical(job.nativeSourceRecord.posting)))
     if(changed)held(job.jobId,Error('complete closing native posting changed'))
     return !changed
    })
   }
   need(Array.isArray(page)&&page.length<=50,'native pagination result changed')
   for(const row of page){
    nativePosting(row);need(!ids.has(row.id),'duplicate native posting across pages');ids.add(row.id);rows.push(row)
   }
   if(phase==='opening'){audit.openingPages++;audit.nativeRecords=rows.length}else audit.closingPages++
   if(page.length<50)return rows
  }
  need(false,'native pagination bound')
 }
 const held=(id,error)=>audit.heldNativeRows.push({id,reason:error.message})
 try{
  const context=await publisher(),opening=await inventory('opening')
  need(opening.some(r=>r.id===context.role.postingId&&r.text===context.role.title),'current corporate/account role identity mismatch')
  for(const row of opening.filter(r=>r.country==='IN')){
   allowed.add(row.hostedUrl);const page=await read(row.hostedUrl)
   try{jobs.push(readNativeRole(row,page.text,clock))}catch(error){held(row.id,error)}
  }
  const closing=await inventory('closing'),end=new Map(closing.map(r=>[r.id,r]))
  audit.nativeInventoryClosingReconciled=canonical(opening)===canonical(closing)
  const stable=[]
  for(const job of jobs){
   try{need(end.has(job.jobId)&&canonical(end.get(job.jobId))===canonical(job.nativeSourceRecord.posting),'complete closing native posting changed');stable.push(job)}catch(error){held(job.jobId,error)}
  }
  jobs=stable
  const surviving=new Map(jobs.map(j=>[j.jobId,j]))
  for(const job of [...jobs]){
   const page=await read(job.sourceUrl)
   try{
    const current=readNativeRole(end.get(job.jobId),page.text,clock)
    need(canonical(current.nativeSourceRecord)===canonical(job.nativeSourceRecord),'full own closing role model changed')
    job.nativeClosingRecord=copy(current.nativeSourceRecord);job.sourceClosingRawNativeHTML=page.text;job.sourceClosingRawNativeHTMLSHA256=page.bodySHA256
   }catch(error){held(job.jobId,error);surviving.delete(job.jobId);jobs=[...surviving.values()]}
  }
  need(canonical(await publisher())===canonical(context),'closing corporate publisher/account context changed')
  for(const job of jobs)Object.assign(job,{sourceDetailComplete:true,sourceDetailStatus:'complete',nativeRoleClosingReconciled:true})
  audit.nativeRoleClosingReconciled=jobs.length
  await options.onAudit?.({...copy(audit),receipts:copy(receipts)})
  options.signal?.throwIfAborted();return finish(jobs.slice(0,cap))
 }catch(error){
  options.signal?.throwIfAborted()
  audit.failures.push({stage:'public-native-model-read',status:error.status??null,message:error.message})
  if(jobs.length){for(const job of jobs)Object.assign(job,{sourceDetailComplete:false,sourceDetailStatus:'partial',nativeRoleClosingReconciled:false});audit.nativeRoleClosingReconciled=0;return finish(jobs.slice(0,cap))}
  Object.assign(error,{source:SOURCE,abortRetries:true,failureKind:'incomplete_listing',recruitmentObservations:audit,
   inventoryEvidence:{status:'coverage-gap',surface:HOME,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:receipts.length,verifiedAt:clock,reason:error.message}})
  throw error
 }finally{clearTimeout(deadline)}
}})
