import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {performance} from 'node:perf_hooks'
import {run, hasOfficialCareersSignal} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createAvizvaPublicReader} from './publicRead.js'
import {isIndiaJob} from '../../scraper-support/utils/indiaLocationFilter.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261105.json.gz',import.meta.url))))
const at='2026-11-05T12:13:21.264Z'
const response=label=>fixture.responses.find(r=>r.label===label)
const activeURL=response('embed-active').requestedUrl
const infoURL=response('native-info').requestedUrl
function replay({change={},payload,fetch:custom}={}){
 const calls=[],evidence={},seen=new Map()
 const options={now:()=>at,requestIntervalMs:0,evidence,fetchText:async()=>response('corporate-chrome').body,fetchImpl:custom||(async(url,init)=>{
  calls.push({url,init})
  const captures=fixture.responses.filter(r=>r.requestedUrl===url),ordinal=seen.get(url)||0
  const captured=captures[ordinal];seen.set(url,ordinal+1)
  if(!captured)throw Error('Unexpected replay URL '+url)
  const body=url===activeURL&&payload!==undefined?JSON.stringify(payload):change[url]??captured.body
  return new Response(body,{status:200,headers:{'content-type':captured.headers['content-type']}})
 })}
 return{calls,evidence,options}
}

test('current AVIZVA page title change retains only active corporate Keka handoffs',()=>{
 const html=response('corporate-chrome').body
 assert.equal(hasOfficialCareersSignal(html),true)
 const signal='<title>Careers at AVIZVA | Healthcare Tech Jobs</title><h1>We Aim, Learn, and Grow Each Day with Passion and Purpose</h1><a href="https://avizva.keka.com/careers/jobdetails/120944">Apply Now</a>'
 for(const wrap of [value=>'<!--'+value+'-->',value=>'<template>'+value+'</template>',value=>'<div hidden>'+value+'</div>',value=>'<script type="text/plain">'+value+'</script>'])
  assert.equal(hasOfficialCareersSignal(wrap(signal)),false)
})

test('AVIZVA current exported run uses native active IDs, original full descriptions and typed countries',async()=>{
 const f=replay(),jobs=await run(f.options)
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),['120944','158305'])
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete===true))
 assert.equal(jobs.some(j=>j.jobId==='157359'),false)
 assert.equal(jobs.some(j=>j.jobId==='154713'),false)
 const native=JSON.parse(response('embed-active').body)
 for(const job of jobs){const raw=native.find(r=>String(r.id)===job.jobId);assert.equal(job.sourceRawDescription,raw.description);assert.equal(job.jobDescription,raw.description);assert.deepEqual(job.nativeSourceRecord,raw)}
 assert.equal(jobs.find(j=>j.jobId==='120944').requisitionId,'AVZ00203')
 assert.match(jobs.find(j=>j.jobId==='158305').jobDescriptionText,/At least 3 years of relevant experience/)
 assert.equal(f.evidence.nativeObservations.length,3)
 assert.equal(f.evidence.nativeObservations.find(j=>j.jobId==='154713').country,'United States')
 assert.equal(f.evidence.companyGlobalTotal,null)
 assert.equal(f.evidence.companyIndiaTotal,null)
 assert.deepEqual(readSourceObservationEvidence(jobs,'avizva'),{source:'avizva',recordKind:'vacancy-rows',
  observedRecordCount:3,observedVacancyCount:3,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,3)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,2)
 assert.equal(f.evidence.scope,'configured-public-board')
 assert.ok(jobs.every(j=>j.sourceScopeComplete===true))
 assert.ok(f.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'))
 assert.ok(f.calls.filter(c=>c.url===activeURL).length>=2)
})

test('AVIZVA retains unresolved native country observations instead of city inference',async()=>{
 const rows=JSON.parse(response('embed-active').body)
 rows[0].jobLocations.forEach(place=>{place.countryCode=7;place.countryName=''})
 const f=replay({payload:rows}),jobs=await run(f.options)
 const unknown=jobs.find(j=>j.jobId==='158305')
 assert.ok(unknown)
 assert.equal(unknown.country,null)
 assert.equal(unknown.sourceCountryScopeUnresolved,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.ok(f.evidence.nativeObservations.some(j=>j.jobId==='158305'&&j.country===null))
})

test('AVIZVA does not publish card summaries when native account or active feed is invalid',async()=>{
 for(const change of [{[infoURL]:JSON.stringify({...JSON.parse(response('native-info').body),name:'Other employer'})},{[activeURL]:'{"items":[],"total":0}'}]){
  const f=replay({change})
  await assert.rejects(run(f.options),/identity|inventory|array/i)
 }
})

test('AVIZVA incomplete native details prevent eligible publication without fabricated criteria',async()=>{
 const url=response('native-role-158305').requestedUrl
 const f=replay({change:{[url]:response('native-role-157359').body}})
 const jobs=await run(f.options)
 assert.deepEqual(jobs.map(j=>j.jobId),['120944'])
 assert.equal(f.evidence.nativeObservations.length,3)
 assert.equal(f.evidence.nativeObservations.find(j=>j.jobId==='158305').sourceDetailComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('AVIZVA caller cancellation preserves an opaque reason and makes no network request',async()=>{
 const reason=Object.create(null),controller=new AbortController();controller.abort(reason)
 const f=replay()
 await assert.rejects(run({...f.options,signal:controller.signal}),error=>error===reason)
 assert.equal(f.calls.length,0)
})

test('AVIZVA abort cancels a response that arrives after the caller has left',async()=>{
 const controller=new AbortController(),reason=Object.create(null)
 let resolve,cancelled=0
 const f=replay({fetch:()=>new Promise(done=>{resolve=done})})
 const running=run({...f.options,signal:controller.signal})
 await new Promise(done=>setImmediate(done))
 controller.abort(reason)
 await assert.rejects(running,error=>error===reason)
 resolve(new Response(new ReadableStream({cancel(){cancelled++}}),{headers:{'content-type':'text/html'}}))
 await new Promise(done=>setImmediate(done))
 assert.equal(cancelled,1)
})

test('AVIZVA cleans up denied or oversized response bodies and does not follow redirects',async()=>{
 for(const status of[301,403,429]){
  let cancelled=0
  const f=replay({fetch:async()=>new Response(new ReadableStream({cancel(){cancelled++}}),{status,headers:{'content-type':'text/html',location:'https://example.com/'}})})
  await assert.rejects(run(f.options),/HTTP/)
  assert.equal(cancelled,1)
 }
 let cancelled=0
 const f=replay({fetch:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(1025))},cancel(){cancelled++}}),{headers:{'content-type':'text/html'}})})
 await assert.rejects(run({...f.options,maxResponseBytes:1024}),/byte|body|limit/i)
 assert.equal(cancelled,1)
})

test('AVIZVA bounds a stuck read and cancels the reader',async()=>{
 let cancelled=0
 const f=replay({fetch:async()=>new Response(new ReadableStream({cancel(){cancelled++}}),{headers:{'content-type':'text/html'}})})
 await assert.rejects(run({...f.options,requestTimeoutMs:10}),/deadline/i)
 assert.equal(cancelled,1)
})

test('AVIZVA legacy card-only injection cannot publish a summary or start an unbound request',async()=>{
 await assert.rejects(run({fetchText:async()=>response('corporate-chrome').body,requestIntervalMs:0}),/native inventory|fetchImpl/i)
})

test('AVIZVA closing inventory removal cannot publish a no-longer-confirmed role',async()=>{
 const f=replay(),original=f.options.fetchImpl;let reads=0
 f.options.fetchImpl=async(url,init)=>{
  if(url===activeURL&&++reads===2)return new Response(JSON.stringify(JSON.parse(response('embed-active').body).filter(row=>row.id!==158305)),{headers:{'content-type':'application/json'}})
  return original(url,init)
 }
 const jobs=await run(f.options)
 assert.deepEqual(jobs.map(j=>j.jobId),['120944'])
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.match(f.evidence.reasons.join(';'),/closing-native-inventory-changed/)
})

test('AVIZVA registered wrapper and pure normalization retain unresolved country and full native criteria',async()=>{
 const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
 const {normalizeScrapedJob}=await import('../../scraper-support/utils/normalizeScrapedJob.js')
 const rows=JSON.parse(response('embed-active').body)
 rows[0].jobLocations.forEach(place=>{place.countryCode=null;place.countryName='Remote'})
 const f=replay({payload:rows}),provider=getScraperCatalog().find(p=>p.source==='avizva')
 const jobs=await createCatalogScraper(provider).run(f.options)
 const unknown=jobs.find(j=>j.jobId==='158305'),normalized=normalizeScrapedJob(unknown,provider)
 assert.equal(unknown.country,null)
 assert.equal(normalized.country,null)
 assert.equal(normalized.sourceCountryScopeUnresolved,true)
 assert.equal(normalized.sourceRawDescription,rows[0].description)
 assert.equal(normalized.sourceDescription,rows[0].description)
})

test('AVIZVA an additional active native hiring handoff keeps known full roles partial',async()=>{
 const template=response('native-template')
 const added=template.body.replace('</body>','<a href="https://other.greenhouse.io/jobs">More jobs</a></body>')
 const f=replay({change:{[template.requestedUrl]:added}}),jobs=await run(f.options)
 assert.equal(jobs.length,2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.match(f.evidence.reasons.join(';'),/additional.*native.*hiring/i)
 assert.ok(jobs.every(j=>j.lifecycleCleanupAllowed===false))
})

const busy=duration=>{const end=performance.now()+duration;while(performance.now()<end){}}
test('AVIZVA monotonic request deadline rejects late synchronous JSON parsing',async()=>{
 const url='https://www.avizva.com/career',body='{"avizvaDeadlineControl":true}'
 const io=createAvizvaPublicReader({timeoutMs:1000,requestTimeoutMs:5,requestIntervalMs:0,
  fetchImpl:async()=>new Response(body,{headers:{'content-type':'application/json'}})},value=>value===url)
 const original=JSON.parse
 JSON.parse=function(text,...args){if(text===body)busy(30);return original.call(this,text,...args)}
 try{await assert.rejects(io.read(url,'json'),/deadline/i)}finally{JSON.parse=original;io.close()}
})

test('AVIZVA monotonic late synchronous response is cancelled before its ready body is pulled',async()=>{
 const url='https://www.avizva.com/career';let cancelled=0,pulls=0
 const io=createAvizvaPublicReader({timeoutMs:1000,requestTimeoutMs:5,requestIntervalMs:0,fetchImpl:()=>{
  const body=new ReadableStream({pull(c){pulls++;c.enqueue(Buffer.from('<p>late body</p>'));c.close()},cancel(){cancelled++}},{highWaterMark:0})
  const result=new Response(body,{headers:{'content-type':'text/html'}});busy(30);return result
 }},value=>value===url)
 try{await assert.rejects(io.read(url),/deadline/i);assert.equal(cancelled,1);assert.equal(pulls,0)}finally{io.close()}
})

test('AVIZVA final evidence delivery preserves exact cancellation before returning any result',async()=>{
 const controller=new AbortController(),reason=Object.create(null),f=replay()
 const evidence=new Proxy({},{set(target,name,value){if(name==='configuredPublicBoardComplete')controller.abort(reason);return Reflect.set(target,name,value)}})
 await assert.rejects(run({...f.options,evidence,signal:controller.signal}),error=>error===reason)
})

test('AVIZVA confirmed India worksite survives an unresolved secondary own country while scope stays partial',async()=>{
 const rows=JSON.parse(response('embed-active').body),target=rows.find(row=>row.id===158305)
 target.jobLocations[1].countryCode=null
 target.jobLocations[1].countryName=''
 const f=replay({payload:rows}),jobs=await run(f.options),job=jobs.find(row=>row.jobId==='158305')
 assert.ok(job)
 assert.equal(job.country,'India')
 assert.equal(job.sourceCountryScopeUnresolved,true)
 assert.equal(isIndiaJob(job),true)
 assert.equal(job.sourceListingComplete,false)
 assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(f.evidence.lifecycleCleanupAllowed,false)
 assert.deepEqual(job.nativeCountryLocations,target.jobLocations)
})

test('AVIZVA IN and US conflict within the same sole worksite does not independently prove India',async()=>{
 const rows=JSON.parse(response('embed-active').body),target=rows.find(row=>row.id===158305)
 target.jobLocations=[{...target.jobLocations[0],countryCode:'IN',countryName:'United States'}]
 const f=replay({payload:rows}),jobs=await run(f.options)
 const observed=f.evidence.nativeObservations.find(row=>row.jobId==='158305')
 assert.equal(observed.country,null)
 assert.equal(observed.sourceCountryScopeUnresolved,true)
 assert.equal(jobs.some(job=>job.jobId==='158305'&&job.country==='India'),false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('AVIZVA non-byte stream chunks fail before copying or corrupting byte counters',async()=>{
 const url='https://www.avizva.com/career',chunk=[60,112,62,120,60,47,112,62];let reads=0,cancelled=0,copies=0
 const io=createAvizvaPublicReader({requestIntervalMs:0,maxResponseBytes:1,maxTotalBytes:1,fetchImpl:async()=>({
  status:200,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{
   read:async()=>++reads===1?{done:false,value:chunk}:{done:true},cancel(){cancelled++},
  }}}
 })},value=>value===url)
 const original=Buffer.from
 Buffer.from=function(value,...args){if(value===chunk)copies++;return original.call(Buffer,value,...args)}
 try{await assert.rejects(io.read(url),/byte|chunk|stream|limit/i);assert.equal(copies,0);assert.equal(cancelled,1)}
 finally{Buffer.from=original;io.close()}
})

test('AVIZVA MIME-looking parameters cannot authorize a text/plain document',async()=>{
 const url='https://www.avizva.com/career';let acquired=0,cancelled=0
 const body={getReader(){acquired++;return{read:async()=>({done:true}),cancel(){cancelled++}}},cancel(){cancelled++}}
 const io=createAvizvaPublicReader({requestIntervalMs:0,fetchImpl:async()=>({status:200,url,
  headers:new Headers({'content-type':'text/plain; note="text/html"'}),body})},value=>value===url)
 try{await assert.rejects(io.read(url),/MIME/i);assert.equal(acquired,0);assert.equal(cancelled,1)}finally{io.close()}
})

test('AVIZVA rejects a promised reader and owns both its original body and eventual reader',async()=>{
 const url='https://www.avizva.com/career';let resolveReader,bodyCancelled=0,readerCancelled=0
 const body={getReader(){return new Promise(resolve=>{resolveReader=resolve})},cancel(){bodyCancelled++;return new Promise(()=>{})}}
 const io=createAvizvaPublicReader({requestIntervalMs:0,fetchImpl:async()=>({status:200,url,
  headers:new Headers({'content-type':'text/html'}),body})},value=>value===url)
 try{
  await assert.rejects(io.read(url),/reader|stream/i)
  resolveReader({cancel(){readerCancelled++;return new Promise(()=>{})}})
  await new Promise(done=>setImmediate(done))
  assert.equal(bodyCancelled,1);assert.equal(readerCancelled,1)
 }finally{io.close()}
})

test('AVIZVA deferred acquisition disposes a real locked reader and preserves exact null caller abort',async()=>{
 const url='https://www.avizva.com/career',controller=new AbortController()
 let resolveReader,acquired,readerCancelled=0,bodyCancelAttempts=0
 const started=new Promise(resolve=>{acquired=resolve})
 const stream=new ReadableStream({cancel(){readerCancelled++}})
 const body={getReader(){const reader=stream.getReader();acquired();return new Promise(resolve=>{resolveReader=()=>resolve(reader)})},
  cancel(){bodyCancelAttempts++;return stream.cancel()}}
 const io=createAvizvaPublicReader({requestIntervalMs:0,signal:controller.signal,fetchImpl:async()=>({status:200,url,
  headers:new Headers({'content-type':'text/html'}),body})},value=>value===url)
 try{
  const pending=io.read(url);await started;controller.abort(null)
  await assert.rejects(pending,error=>error===null)
  resolveReader();await new Promise(done=>setImmediate(done))
  assert.equal(bodyCancelAttempts,1);assert.equal(readerCancelled,1)
 }finally{try{io.close()}catch(error){assert.equal(error,null)}}
})

test('AVIZVA active corporate typed hiring carriers make configured board scope partial',async()=>{
 for(const carrier of ['<iframe src="https://jobs.ashbyhq.com/unreviewed-native-test"></iframe>',
  '<script type="application/ld+json">{"@type":"JobPosting","title":"Additional native role","url":"https://jobs.ashbyhq.com/unreviewed-native-test"}</script>']){
  const corporate=response('corporate-chrome'),f=replay({change:{[corporate.requestedUrl]:corporate.body.replace('</body>',carrier+'</body>')}})
  const jobs=await run(f.options)
  assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(f.evidence.lifecycleCleanupAllowed,false)
 }
})

test('AVIZVA inert corporate carriers do not fabricate an additional active inventory',async()=>{
 const carrier='<iframe src="https://jobs.ashbyhq.com/unreviewed-native-test"></iframe><script type="application/ld+json">{"@type":"JobPosting"}</script>'
 for(const wrap of [body=>'<!--'+body+'-->',body=>'<template>'+body+'</template>',body=>'<div hidden>'+body+'</div>']){
  const corporate=response('corporate-chrome'),f=replay({change:{[corporate.requestedUrl]:corporate.body.replace('</body>',wrap(carrier)+'</body>')}})
  assert.equal(readInventoryEvidence(await run(f.options)).listingComplete,true)
 }
})

test('AVIZVA blank and generic contact frames are not typed vacancy carriers',async()=>{
 const corporate=response('corporate-chrome'),carrier='<iframe></iframe><iframe src="https://example.org/contact"></iframe>'
 const f=replay({change:{[corporate.requestedUrl]:corporate.body.replace('</body>',carrier+'</body>')}})
 assert.equal(readInventoryEvidence(await run(f.options)).listingComplete,true)
})

test('AVIZVA a conflicted own worksite never borrows India from an independently valid worksite',async()=>{
 const rows=JSON.parse(response('embed-active').body),target=rows.find(row=>row.id===158305)
 target.jobLocations[0].countryName='United States'
 const f=replay({payload:rows}),job=(await run(f.options)).find(row=>row.jobId==='158305')
 assert.ok(job);assert.equal(job.country,'India');assert.equal(job.sourceCountryScopeUnresolved,true)
 assert.ok(job.locations.some(label=>label.includes('Indore')&&label.includes('India')))
 assert.equal(job.locations.some(label=>label.includes('Gurugram')&&label.includes('India')),false)
 assert.deepEqual(job.nativeCountryLocations,target.jobLocations)
 assert.equal(job.lifecycleCleanupAllowed,false)
})
