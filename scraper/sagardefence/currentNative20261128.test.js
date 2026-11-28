import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createSagarDefenceScraper,HOMEPAGE_URL} from './script.js'
import {buildScrapers} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261128.json.gz',import.meta.url))))
const career='https://www.sagardefence.com/careers',bodies=new Map(fixture.packets.map(row=>[row.requestedUrl,row.body]))
const clone=value=>structuredClone(value),escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
function render(records){
 const model=clone(fixture.model);model[3].children[3].openings=records
 const cards=records.slice(0,6).map(row=>fixture.cardTemplate.replace(/\{\{(department|title|description|location)\}\}/g,(_,key)=>escape(row[key]))).join('')
 const pages=Math.max(1,Math.ceil(records.length/6)),buttons=fixture.paginationButtons
 const numbers=pages<=5?Array.from({length:pages},(_,i)=>i+1):[1,2,'gap',pages]
 const navigation=pages>1?fixture.paginationOpen+buttons[0]+numbers.map(n=>n===1?buttons[1]:n==='gap'?'<span class="px-1 text-sm text-muted" aria-hidden="true">..</span>':buttons[2].replace('>2</button>',`>${n}</button>`)).join('')+buttons.at(-1)+'</div>':''
 const empty=records.length?'':'<p class="mt-10 text-center text-sm text-muted">No openings right now.</p>'
 return fixture.careers.replace(fixture.flightLiteral,JSON.stringify('13:'+JSON.stringify(model)+'\n')).replace(fixture.region,fixture.gridOpen+cards+'</div>'+empty+navigation)
}
function transport({records=fixture.records,mutate=(url,body)=>body,metadata=()=>({}),signal}={}){
 const calls=[],counts=new Map()
 const fetchPage=async(url,options)=>{
  calls.push({url,options});const n=(counts.get(url)??0)+1;counts.set(url,n)
  assert.ok(bodies.has(url),`Unexpected native request ${url}`)
  const raw=url===career?render(records):bodies.get(url)
  return {status:200,url,html:mutate(url,raw,n),...metadata(url,n)}
 }
 return {calls,counts,fetchPage,run:()=>createSagarDefenceScraper().run({fetchPage,signal,now:()=> '2026-11-28T04:00:00.000Z'})}
}
function held(jobs,records=14){
 assert.equal(jobs.length,0);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const inventory=readInventoryEvidence(jobs),observation=readSourceObservationEvidence(jobs,'sagardefence'),audit=jobs.nativeCollectionEvidence
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
 assert.equal(observation.observedRecordCount,records);assert.equal(observation.companyIndiaTotal,null)
 for(const key of ['sourceScopeComplete','companyInventoryComplete','configuredBoardComplete','sourceListingComplete','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete','sourceAvailabilityVerified','lifecycleCleanupAllowed'])assert.equal(audit[key],false,key)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 return audit
}

test('genuine complete native Flight array retains fourteen rows beyond the six SSR previews without India authority',async()=>{
 const reader=transport(),jobs=await reader.run(),audit=held(jobs)
 assert.equal(reader.calls.length,32)
 for(const phase of ['opening','closing']){
  assert.deepEqual(audit[phase].records,fixture.records)
  assert.equal(audit[phase].DOMPreviewCount,6)
  assert.equal(audit[phase].nativePageCount,3)
  assert.equal(audit[phase].careers,render(fixture.records))
  assert.equal(audit[phase].assets.length,14)
  for(const row of audit[phase].heldRecords)assert.equal(row.reason,'native-country-publication-application-unqualified')
 }
})
test('registered current result retains the fourteen raw native rows and cannot become successful company zero',async()=>{
 const reader=transport(),scraper=buildScrapers().find(row=>row.name==='sagardefence')
 const jobs=await scraper.run({fetchPage:reader.fetchPage})
 const audit=held(jobs),assessment=assessSoftFailureAcquisition(scraper.provider,jobs)
 assert.equal(audit.opening.records.length,14)
 assert.notEqual(assessment.success,true)
})
for(const count of [0,1,6,7,15,31])test(`native ${count}-record synthetic variation is not a fixed six/fourteen data set or authoritative zero`,async()=>{
 const records=Array.from({length:count},(_,i)=>({...clone(fixture.records[i%14]),id:`a0000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`}))
 const audit=held(await transport({records}).run(),count)
 assert.deepEqual(audit.opening.records,records)
 assert.equal(audit.opening.DOMPreviewCount,Math.min(count,6))
 assert.equal(audit.opening.nativePageCount,Math.max(1,Math.ceil(count/6)))
})
for(const location of ['Pune, India','London, United Kingdom','Pune / London','Remote',''])test(`native location ${JSON.stringify(location)} remains raw and never borrows company or applicant country`,async()=>{
 const records=clone(fixture.records);records.at(-1).location=location
 const audit=held(await transport({records}).run())
 assert.equal(audit.opening.records.at(-1).location,location)
})
test('new country, eligibility, publication and application fields are retained unqualified in both complete native snapshots',async()=>{
 const records=clone(fixture.records)
 Object.assign(records.at(-1),{country:'India',applicantLocationRequirements:{name:'United Kingdom'},validThrough:'2027-02-30',salary:'GBP 50k',applicationURL:'https://foreign.invalid/apply',active:true})
 const audit=held(await transport({records}).run())
 for(const phase of ['opening','closing'])assert.deepEqual(audit[phase].records.at(-1),records.at(-1))
})
for(const key of ['id','title','description','department','experience'])test(`malformed native ${key} never disappears behind country holds`,async()=>{
 const records=clone(fixture.records);records.at(-1)[key]=''
 await assert.rejects(transport({records}).run(),/native record/i)
})
test('duplicate UUIDs anywhere in the full native array remain fatal',async()=>{
 const records=clone(fixture.records);records.at(-1).id=records[0].id
 await assert.rejects(transport({records}).run(),/duplicate|native record/i)
})
for(const [label,mutate] of [
 ['changed employer shell',(url,body)=>url===HOMEPAGE_URL?body.replace('Sagar Defence Engineering','Other Defence Engineering'):body],
 ['wrong native component binding',(url,body)=>url===career?body.replace('GrowWithUs','OtherOpenings'):body],
 ['extra HTML programme',(url,body)=>url===career?body.replace('</body>','<script>self.unreviewed=true</script></body>'):body],
 ['changed full criteria preview',(url,body)=>url===career?body.replace('3D CAD Modeling','THIN PREVIEW'):body],
 ['new SSR application attribute',(url,body)=>url===career?body.replace('class="group/link','formaction="https://foreign.invalid" class="group/link'):body],
 ['tampered complete native client',(url,body)=>url.includes('/app/careers/')?body+';unreviewed=true':body],
 ['tampered complete CSS',(url,body)=>url.endsWith('.css')?body+'body{display:none}':body],
 ['closing fourteenth held criteria drift',(url,body,n)=>url===career&&n===2?render(fixture.records.map((r,i)=>i===13?{...r,description:r.description+' Changed condition.'}:r)):body],
 ['closing record membership drift',(url,body,n)=>url===career&&n===2?render(fixture.records.slice(0,-1)):body],
])test(label+' fails closed before any authoritative result',async()=>{
 await assert.rejects(transport({mutate}).run(),/native|current|homepage|closing|profile|preview/i)
})
test('URL identity holds even for complete supplied native HTML',async()=>{
 await assert.rejects(transport({metadata:url=>url===career?{url:'https://foreign.invalid/careers'}:{}}).run(),/response|URL|identity/i)
})
test('pre-aborted opaque caller performs no reads or reason coercion',async()=>{
 const controller=new AbortController(),reason=Object.freeze({toString(){throw Error('coerced')}});controller.abort(reason)
 const reader=transport({signal:controller.signal});await assert.rejects(reader.run(),e=>e===reason);assert.equal(reader.calls.length,0)
})
test('an injected stalled reader cannot suppress prompt exact caller cancellation',async()=>{
 const controller=new AbortController(),reason=Object.freeze({message:'controlled opaque caller'})
 const run=createSagarDefenceScraper().run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})})
 setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(Promise.race([run,new Promise((_,reject)=>setTimeout(()=>reject(Error('caller cancellation lost')),200))]),e=>e===reason)
})
test('default HTTP403 explicit challenge is terminal before text and owns body disposal',async t=>{
 let reads=0,cancels=0,calls=0
 t.mock.method(globalThis,'fetch',async url=>{calls++;return {status:403,ok:false,url,headers:new Headers({'cf-mitigated':'challenge'}),bodyUsed:false,body:{cancel:()=>cancels++},text:async()=>{reads++;return fixture.homepage}}})
 await assert.rejects(createSagarDefenceScraper().run(),e=>e.httpStatus===403&&e.accessChallenge===true&&e.abortRetries===true)
 assert.equal(calls,1);assert.equal(reads,0);assert.equal(cancels,1)
})
test('genuine fixture has complete and independently hashed native bodies',()=>{
 assert.equal(fixture.packets.length,17)
 for(const row of fixture.packets)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
 assert.equal(fixture.provenance.publisherJavaScriptExecuted,false)
})
test('additional UUID case variation cannot create a second identity for an existing native role',async()=>{
 const records=clone(fixture.records);records.at(-1).id=records[0].id.toUpperCase()
 await assert.rejects(transport({records}).run(),/duplicate/i)
})
test('additional final callback cancellation prevents committing otherwise paired native observations',async()=>{
 const controller=new AbortController(),reason=Object.freeze({message:'cancel before commit'}),reader=transport()
 await assert.rejects(createSagarDefenceScraper().run({signal:controller.signal,fetchPage:reader.fetchPage,now:()=>{controller.abort(reason);return '2026-11-28T04:00:00.000Z'}}),e=>e===reason)
})
test('additional caller-like authority flags inside a native DTO remain raw without overriding source holds',async()=>{
 const records=clone(fixture.records);Object.assign(records.at(-1),{sourceScopeComplete:true,lifecycleCleanupAllowed:true,sourceDetailComplete:true,sourceCountryQualificationComplete:true})
 const audit=held(await transport({records}).run());assert.deepEqual(audit.closing.records.at(-1),records.at(-1))
})
test('additional old email-only path also keeps configured/company zero and cleanup unqualified',async()=>{
 const old={
  [HOMEPAGE_URL]:'<h1>Sagar Defence Engineering</h1><a href="/careers/">Careers</a><a href="/about-us/">About</a><a href="/contact/">Contact</a>',
  'https://www.sagardefence.com/careers/':'<h1>Careers</h1><p>Send your resume and your goals to careers@sagardefence.com. We build next-generation defence systems.</p>',
  'https://www.sagardefence.com/contact/':'<h1>Contact</h1><p>info@sagardefence.com Pune</p>',
 }
 const jobs=await createSagarDefenceScraper().run({fetchPage:async url=>({url,status:200,html:old[url]})})
 const audit=held(jobs,0);assert.equal(audit.nativeInventoryPaired,false);assert.equal(audit.legacy.careers,old['https://www.sagardefence.com/careers/'])
})
test('additional abort-ignoring fetch retains ownership of its late unread response disposal',async t=>{
 const controller=new AbortController(),reason=Object.freeze({message:'controlled late response'});let resolveFetch,cancels=0,reads=0
 t.mock.method(globalThis,'fetch',()=>new Promise(resolve=>{resolveFetch=resolve}))
 const run=createSagarDefenceScraper().run({signal:controller.signal})
 await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 await assert.rejects(run,e=>e===reason)
 resolveFetch({status:200,ok:true,url:HOMEPAGE_URL,headers:new Headers(),bodyUsed:false,body:{cancel:()=>cancels++},text:async()=>{reads++;return fixture.homepage}})
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(cancels,1);assert.equal(reads,0)
})
test('additional default HTTP429 keeps Retry-After and terminal cleanup without another request',async t=>{
 let calls=0,reads=0,cancels=0
 t.mock.method(globalThis,'fetch',async url=>{calls++;return {status:429,ok:false,url,headers:new Headers({'retry-after':'11'}),bodyUsed:false,body:{cancel:()=>cancels++},text:async()=>{reads++;return ''}}})
 await assert.rejects(createSagarDefenceScraper().run(),e=>e.status===429&&e.retryDelayMs===11000)
 assert.equal(calls,1);assert.equal(reads,0);assert.equal(cancels,1)
})
test('additional opaque null caller cancellation during response cleanup remains exact',async t=>{
 const controller=new AbortController();let reads=0
 t.mock.method(globalThis,'fetch',async url=>({status:403,ok:false,url,headers:new Headers({'x-amzn-waf-action':'challenge'}),bodyUsed:false,body:{cancel:()=>controller.abort(null)},text:async()=>{reads++;return ''}}))
 let caught,thrown=false
 try{await createSagarDefenceScraper().run({signal:controller.signal})}catch(error){caught=error;thrown=true}
 assert.equal(thrown,true);assert.equal(caught,null);assert.equal(reads,0)
})
test('additional injected HTTP200 challenge metadata cannot qualify native HTML',async()=>{
 let calls=0
 await assert.rejects(createSagarDefenceScraper().run({fetchPage:async url=>{calls++;return {status:200,url,headers:new Headers({'cf-mitigated':'challenge'}),html:fixture.homepage}}}),e=>e.accessChallenge===true)
 assert.equal(calls,1)
})
test('stream-order genuine literal-null registration movement preserves all remaining bytes and raw paired snapshots',async()=>{
 const moved=fixture.streamingVariant.body,nullScript=fixture.nullRegistrationScript
 assert.equal(fixture.careers.replace(nullScript,''),moved.replace(nullScript,''))
 const audit=held(await transport({mutate:(url,body,n)=>url===career&&n===2?moved:body}).run())
 assert.equal(audit.opening.careers,render(fixture.records));assert.equal(audit.closing.careers,moved)
 assert.deepEqual(audit.opening.records,audit.closing.records)
})
for(const [label,change]of [
 ['non-null result',s=>s.replace('12:null','12:{}')],
 ['extra programme',s=>s.replace('])</script>',']);self.unreviewed=true</script>')],
 ['new script attributes',s=>s.replace('<script>','<script type="module">')],
 ['foreign/inert ancestry',s=>'<template>'+s+'</template>'],
 ['duplicate registration',s=>s+s],
])test('stream-order '+label+' cannot enter the exact literal-null normalization',async()=>{
 const body=fixture.careers.replace(fixture.nullRegistrationScript,change(fixture.nullRegistrationScript))
 await assert.rejects(transport({mutate:(url,value)=>url===career?body:value}).run(),/native|profile|carrier|registration/i)
})
test('complete genuine ordinary registered graph replays all35 bodies including existing fallback and exact raw native snapshots',async t=>{
 const graph=fixture.actualRegisteredFinal;assert.ok(graph)
 let index=0
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const packet=graph.packets[index++];assert.ok(packet,'Unexpected extra native HTTP read')
  assert.equal(String(input),packet.requestedUrl);assert.equal(init.method??'GET',packet.method)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url})
  Object.defineProperty(response,'redirected',{value:packet.url!==packet.requestedUrl})
  return response
 })
 const scraper=buildScrapers().find(row=>row.name==='sagardefence'),jobs=await scraper.run(),audit=held(jobs)
 assert.equal(index,35);assert.equal(index,graph.packets.length)
 for(const phase of ['opening','closing'])assert.deepEqual(audit[phase],graph.metadata.ownProperties.nativeCollectionEvidence[phase])
 const assessment=assessSoftFailureAcquisition(scraper.provider,jobs)
 assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.rawRecords,14)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
 assert.equal(jobs.emptyOnlyRecruitmentRecovery.requestCount,3)
 assert.deepEqual(jobs.emptyOnlyRecruitmentRecovery.failures,[])
 for(const packet of graph.packets)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
})
