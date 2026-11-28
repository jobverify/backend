import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-20261128.json.gz',import.meta.url))))
const HOME='https://www.thoughtworks.com/careers/jobs',API='https://www.thoughtworks.com/rest/careersv2/jobs'
const ID='62de561f-b140-49df-97ff-33c488077598',DETAIL=HOME+'/'+ID
const oldAPI='https://boards-api.greenhouse.io/v1/boards/thoughtworks/jobs?content=true'
const packets=new Map(fixture.packets.map(row=>[row.requestedUrl,row]))
const native=JSON.parse(packets.get(API).body),sha=value=>createHash('sha256').update(value).digest('hex')
const provider=()=>getScraperCatalog().find(row=>row.source==='thoughtworks')
const replay=(edit=()=>{})=>{
 const reads=[],counts=new Map()
 return{reads,fetchPage:async(url,init={})=>{
  init.signal?.throwIfAborted();const occurrence=(counts.get(url)??0)+1;counts.set(url,occurrence)
  reads.push({url,init,occurrence});const packet=packets.get(url)
  assert.ok(packet,'Only a genuine currently retained public query is allowed: '+url)
  assert.equal(init.method??'GET','GET');assert.equal(init.body??null,null)
  const response={url:packet.url,status:packet.status,headers:{...packet.headers},contentType:packet.headers['content-type'],body:packet.body}
  return edit({url,init,occurrence,response})??response
 }}
}
async function execute(source,options={}){
 const original=globalThis.fetch
 globalThis.fetch=async(url,init)=>{
  const page=await source.fetchPage(String(url),init),response=new Response(page.body,{status:page.status,headers:page.headers})
  Object.defineProperty(response,'url',{value:page.url});return response
 }
 try{return await createCatalogScraper(provider()).run({fetchPage:source.fetchPage,...options})}
 finally{globalThis.fetch=original}
}

test('seven genuine originals bind the new31-row first-party producer and the currently retired404 endpoint',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.validCurrentCheck,false);assert.equal(fixture.publisherProgramsExecuted,false)
 assert.equal(packets.size,7);for(const row of packets.values())assert.equal(sha(row.body),row.sha256)
 assert.equal(packets.get(oldAPI).status,404);assert.equal(native.jobs.length,31)
 assert.equal(native.jobs.filter(row=>row.country==='India').length,1)
 const client=fixture.packets.find(row=>row.requestedUrl.includes('clientlib-site.min.')).body
 assert.ok(client.includes('fetch(e,{method:"GET",headers:{"Content-Type":"application/json"}})'))
 assert.ok(client.includes('t.allOpenJobs=t.jobResults=e.jobs'))
 assert.ok(client.includes('e.substring(0,e.lastIndexOf("/")+1).concat(t)'))
})

test('registered Thoughtworks selects its own current script while retaining explicit company/cleanup holds',()=>{
 const current=provider();assert.equal(current.adapter,'script');assert.ok(current.modulePath.replaceAll('\\','/').endsWith('/thoughtworks/script.js'))
 assert.equal(current.sourceScopeComplete,false);assert.equal(current.lifecycleCleanupAllowed,false)
 assert.equal(current.verifiedPublicJobCount,null);assert.equal(current.verifiedIndiaJobCount,null)
})

test('genuine current replay retains all31raw rows and one correlated India role without full-rendering/company authority',async()=>{
 const source=replay(),jobs=await execute(source),audit=jobs.nativeCollectionEvidence,assessment=assessSoftFailureAcquisition(provider(),jobs)
 assert.equal(source.reads.length,9);assert.equal(source.reads.some(row=>row.url===oldAPI),false)
 assert.equal(jobs.length,1);const job=jobs[0]
 assert.equal(job.jobId,ID);assert.equal(job.title,'Senior Industry Expert (R14990)');assert.equal(job.country,'India')
 assert.equal(job.city,null);assert.equal(job.locations.length,6);assert.equal(job.sourceUrl,DETAIL)
 assert.equal(job.applyUrl,DETAIL+'#apply-job');assert.equal(job.postingDate,'2026-11-26T00:00:00.000Z')
 assert.equal(job.sourceNativePublication.field,'Date Posted');assert.equal(job.sourceNativePublication.raw,'11-26-2026')
 assert.deepEqual(job.sourceNativeRecord,native.jobs.find(row=>row.sourceSystemId===ID))
 assert.equal(job.sourceNativeDetail.html,packets.get(DETAIL).body);assert.ok(job.sourceDescription.includes('Job responsibilities'))
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 assert.deepEqual(audit.observations.map(row=>row.listingRecord),native.jobs);assert.deepEqual(audit.closingRecords,native.jobs)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(assessment.indiaJobs,1);assert.equal(assessment.runnerOutcome.rawRecords,31);assert.equal(assessment.runnerOutcome.partial,true)
 assert.equal(assessment.inventoryEvidence.listingComplete,false);assert.equal(assessment.inventoryEvidence.status,'discovery-only')
 assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

test('native detail Date Posted remains separate from mutable listing updatedAt',async()=>{
 const source=replay(({url,response})=>{
  if(url!==API)return
  const data=JSON.parse(response.body);data.jobs.find(row=>row.sourceSystemId===ID).updatedAt='01-01-2000'
  return{...response,body:JSON.stringify(data)}
 })
 const [job]=await execute(source);assert.equal(job.postingDate,'2026-11-26T00:00:00.000Z')
 assert.equal(job.sourceNativeRecord.updatedAt,'01-01-2000')
})

for(const country of [null,'India; Singapore'])test('unpublished or ambiguous native country is retained without a city-based India inference: '+country,async()=>{
 const source=replay(({url,response})=>{
  if(url!==API)return
  const data=JSON.parse(response.body);data.jobs.find(row=>row.sourceSystemId===ID).country=country
  return{...response,body:JSON.stringify(data)}
 })
 const jobs=await execute(source),assessment=assessSoftFailureAcquisition(provider(),jobs)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,31)
 assert.equal(source.reads.some(row=>row.url===DETAIL),false);assert.equal(assessment.zeroJobEvidence,'blocked-zero')
 assert.equal(assessment.runnerOutcome.partial,true);assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

for(const[name,change]of[
 ['foreign jobs producer',body=>body.replace('data-jobs-url="'+API+'"','data-jobs-url="https://unrelated.example/jobs"')],
 ['hidden producer owner',body=>body.replace("class='cmp-job-search__container", "hidden class='cmp-job-search__container")],
 ['second producer owner',body=>body.replace('</body>',"<div class='cmp-job-search__container' data-jobs-url='"+API+"'></div></body>")],
])test('changed current corporate '+name+' rejects before any native read',async()=>{
 const source=replay(({url,response})=>url===HOME?{...response,body:change(response.body)}:undefined)
 await assert.rejects(execute(source),/Thoughtworks native/);assert.equal(source.reads.length,1)
})

test('an altered whole current producer program cannot authorize the first-party JSON endpoint',async()=>{
 const source=replay(({url,response})=>url.includes('clientlib-site.min.')?{...response,body:response.body+';globalThis.unreviewed=true;'}:undefined)
 await assert.rejects(execute(source),/Thoughtworks native.*program/)
 assert.equal(source.reads.some(row=>row.url===API),false)
})

for(const[name,change]of[
 ['role identifier',body=>body.replace('data-jid="'+ID+'"','data-jid="00000000-0000-0000-0000-000000000000"')],
 ['hidden criteria',body=>body.replace('class="cmp-job-details__main text-typography"','hidden class="cmp-job-details__main text-typography"')],
 ['country conflict',body=>body.replace('role="definition">India</div>','role="definition">Singapore</div>')],
 ['invalid native publication',body=>body.replace('role="definition">11-26-2026</div>','role="definition">02-31-2026</div>')],
])test('current native detail '+name+' cannot return an admitted India role',async()=>{
 const source=replay(({url,response})=>{
  if(url!==DETAIL)return
  const body=change(response.body);assert.notEqual(body,response.body);return{...response,body}
 })
 await assert.rejects(execute(source),/Thoughtworks native/)
})

test('duplicate native identities fail before detail reads',async()=>{
 const source=replay(({url,response})=>{
  if(url!==API)return
  const data=JSON.parse(response.body);data.jobs.push(data.jobs[0]);return{...response,body:JSON.stringify(data)}
 })
 await assert.rejects(execute(source),/Thoughtworks native.*(?:duplicate|identity)/)
 assert.equal(source.reads.some(row=>row.url===DETAIL),false)
})

test('closing whole native country drift cannot retain opening positives',async()=>{
 const source=replay(({url,occurrence,response})=>{
  if(url!==API||occurrence!==2)return
  const data=JSON.parse(response.body);data.jobs[0].country='India';return{...response,body:JSON.stringify(data)}
 })
 await assert.rejects(execute(source),/Thoughtworks native.*closing/)
})

test('closing authored criteria drift cannot retain opening positives',async()=>{
 const source=replay(({url,occurrence,response})=>url===DETAIL&&occurrence===2?{...response,body:response.body.replace('Job responsibilities','Changed job responsibilities')}:undefined)
 await assert.rejects(execute(source),/Thoughtworks native.*closing/)
})

test('an empty configured feed remains operational blocked-zero with unknown company scope',async()=>{
 const source=replay(({url,response})=>{
  if(url!==API)return
  const data=JSON.parse(response.body);data.jobs=[];return{...response,body:JSON.stringify(data)}
 })
 const jobs=await execute(source),assessment=assessSoftFailureAcquisition(provider(),jobs)
 assert.equal(jobs.length,0);assert.equal(assessment.zeroJobEvidence,'blocked-zero')
 assert.equal(assessment.runnerOutcome.partial,true);assert.equal(assessment.inventoryEvidence.listingComplete,false)
 assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})

for(const status of [403,429])test('public native HTTP'+status+' remains typed and terminal on its first attempt',async()=>{
 const source=replay(({url,response})=>url===API?{...response,status,headers:{'content-type':'text/html',...(status===429?{'retry-after':'60'}:{'cf-mitigated':'challenge'})}}:undefined)
 await assert.rejects(execute(source),error=>error.httpStatus===status&&error.abortRetries===true&&error.failureKind==='blocked_or_access_denied')
 assert.equal(source.reads.filter(row=>row.url===API).length,1)
})

test('foreign current response URL remains an identity failure even with the expected body',async()=>{
 const source=replay(({url,response})=>url===API?{...response,url:'https://unrelated.example/jobs'}:undefined)
 await assert.rejects(execute(source),error=>error.failureKind==='parser_or_contract_error'&&error.abortRetries===true)
})

test('opaque caller cancellation before or after an awaited fetch is preserved exactly',async()=>{
 for(const before of[true,false]){
  const control=new AbortController(),reason={callerReason:before?'pre':'await'}
  if(before)control.abort(reason)
  const source=replay(()=>{control.abort(reason)})
  await assert.rejects(execute(source,{signal:control.signal}),error=>error===reason)
  assert.equal(source.reads.length,before?0:1)
 }
})

test('ordinary default transport performs only exact passive GETs without executing publishers or reading an application',async()=>{
 const source=replay(),jobs=await execute(source,{fetchPage:undefined})
 assert.equal(jobs.length,1);assert.equal(source.reads.length,9)
 for(const row of source.reads){assert.equal(row.init.credentials,'omit');assert.equal(row.init.redirect,'error');assert.equal(row.init.method,'GET');assert.equal(row.init.body,undefined)}
 assert.equal(source.reads.some(row=>/ashbyhq|greenhouse|apply-job/.test(row.url)),false)
})

test('mutable correlated native titles remain data while the original authored criteria is preserved',async()=>{
 const nextTitle='Principal Engineer (R12345)'
 const source=replay(({url,response})=>{
  if(url===API){const data=JSON.parse(response.body);data.jobs.find(row=>row.sourceSystemId===ID).name=' '+nextTitle;return{...response,body:JSON.stringify(data)}}
  if(url===DETAIL)return{...response,body:response.body.replaceAll('Senior Industry Expert (R14990)',nextTitle)}
 })
 const [job]=await execute(source)
 assert.equal(job.title,nextTitle);assert.match(job.sourceDescription,/Workday Senior Consultant/)
 assert.equal(job.sourceDetailComplete,false)
})

test('unknown native envelope/role keys and invalid role types are terminal before detail collection',async()=>{
 for(const change of [
  data=>{data.hasMore=true},data=>{data.jobs[0].newNativeQualifier='unreviewed'},data=>{data.jobs[0].jobFunctions='Technology'},
 ]){
  const source=replay(({url,response})=>{if(url!==API)return;const data=JSON.parse(response.body);change(data);return{...response,body:JSON.stringify(data)}})
  await assert.rejects(execute(source),/Thoughtworks native/)
  assert.equal(source.reads.some(read=>read.url===DETAIL),false)
 }
})

test('a new assigned location outside the native explicit India location map cannot be promoted by the role country',async()=>{
 const source=replay(({url,response})=>{
  if(url!==API)return
  const data=JSON.parse(response.body);data.jobs.find(row=>row.sourceSystemId===ID).location+='; Singapore'
  return{...response,body:JSON.stringify(data)}
 })
 await assert.rejects(execute(source),/Thoughtworks native.*location/)
 assert.equal(source.reads.some(read=>read.url===DETAIL),false)
})

test('a conflicting same-role application country cannot agree with the native India detail',async()=>{
 const source=replay(({url,response})=>url===DETAIL?{...response,body:response.body.replace('class="cmp-job-application__iframe" data-country="India"','class="cmp-job-application__iframe" data-country="Singapore"')}:undefined)
 await assert.rejects(execute(source),/Thoughtworks native.*country/)
})

test('closing corporate producer and declared-program authority must remain correlated before positives return',async()=>{
 for(const change of [
  body=>body.replace('data-jobs-url="'+API+'"','data-jobs-url="https://other.example/jobs"'),
  body=>body.replace('clientlib-site.min.ACSHASHcd7ae47b40bfdf01d0e39d27f6ad6c0d.js','clientlib-site.min.UNREVIEWED.js'),
 ]){
  const source=replay(({url,occurrence,response})=>url===HOME&&occurrence===2?{...response,body:change(response.body)}:undefined)
  await assert.rejects(execute(source),/Thoughtworks native/)
  assert.equal(source.reads.at(-1).url,HOME)
 }
})

test('explicit HTTP200 access challenges remain typed before native JSON interpretation in both transports',async()=>{
 for(const defaults of[false,true]){
  const source=replay(({url,response})=>url===API?{...response,headers:{...response.headers,'cf-mitigated':'challenge'}}:undefined)
  await assert.rejects(execute(source,defaults?{fetchPage:undefined}:{}),error=>error.httpStatus===200&&error.accessChallenge===true&&error.abortRetries===true&&error.failureKind==='blocked_or_access_denied')
  assert.equal(source.reads.filter(read=>read.url===API).length,1)
 }
})

test('the ordinary default reader rejects an excessive whole program before a native inventory read',async()=>{
 const source=replay(({url,response})=>url.includes('clientlib-dependencies.min.')?{...response,body:'x'.repeat(4*1024*1024+1)}:undefined)
 await assert.rejects(execute(source,{fetchPage:undefined}),/Thoughtworks native.*byte limit/)
 assert.equal(source.reads.some(read=>read.url===API),false)
})

test('opaque null cancellation during a default body read releases its owned reader',async()=>{
 const {run}=await import('./script.js'),originalFetch=globalThis.fetch,control=new AbortController()
 let reads=0,cancelled=0,released=0
 const reader={read:async()=>{reads++;control.abort(null);return{done:false,value:new TextEncoder().encode('<html>')}} ,cancel:async()=>{cancelled++},releaseLock:()=>{released++}}
 try{
  globalThis.fetch=async url=>({status:200,url:String(url),headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>reader}})
  await assert.rejects(run({signal:control.signal}),error=>error===null)
  await new Promise(resolve=>setImmediate(resolve))
 }finally{globalThis.fetch=originalFetch}
 assert.equal(reads,1);assert.equal(cancelled,1);assert.equal(released,1)
})
