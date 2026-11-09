import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {run,HOMEPAGE_URL,CAREERS_URL,PROFILE_URL,JOBS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const load=name=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+name+'.json',import.meta.url)))
const packets=[...load('official-responses'),...load('native-profile-recovery-20261106').responses]
const role=url=>new URL(url).pathname.startsWith('/jobs/view/')
function replay(change=()=>null){
 const calls=[],signals=[]
 const fetchImpl=async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  calls.push(url);signals.push(init.signal);const replacement=change(url,init,calls);if(replacement)return replacement
  const p=packets.find(p=>p.url===url||role(url)&&new URL(p.url).origin===new URL(url).origin&&new URL(p.url).pathname===new URL(url).pathname);assert.ok(p,'Only existing genuine public native entities '+url)
  return{url,status:p.status,headers:new Headers(),body:new Response(p.body).body}
 }
 return{calls,signals,run:options=>run({fetchImpl,now:()=> '2026-11-06T06:56:00.000Z',timeoutMs:2000,requestTimeoutMs:20,...options})}
}
test('pending corporate headers time out locally and strict native recovery remains reachable without a second same-origin read',async()=>{
 const r=replay(url=>url===HOMEPAGE_URL?new Promise(()=>{}):null),jobs=await r.run()
 assert.equal(jobs.length,3);assert.equal(r.calls.includes(CAREERS_URL),false);assert.equal(r.signals[0].aborted,true)
 assert.deepEqual(jobs.map(j=>j.jobId),['4457850766','4457857705','4457866682'])
 assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.country==='India'&&j.lifecycleCleanupAllowed===false))
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.officialAvailability[0].status,null);assert.equal(audit.officialAvailability[0].failureKind,'request-timeout')
 assert.equal(audit.officialAvailability[1].state,'not-read-after-same-origin-timeout')
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'discovery-only');assert.match(readInventoryEvidence(jobs).reason,/corporate.*request.*timeout/i)
})
test('pending corporate body is cancelled locally and is never labelled a verified403',async()=>{
 let cancelled
 const r=replay(url=>url===HOMEPAGE_URL?{url,status:403,headers:new Headers(),body:new ReadableStream({pull(){return new Promise(()=>{})},cancel(reason){cancelled=reason}})}:null),jobs=await r.run()
 assert.equal(jobs.length,3);assert.equal(cancelled?.code,'RENEWBUY_REQUEST_TIMEOUT')
 const availability=jobs.nativeCollectionEvidence.officialAvailability[0];assert.equal(availability.status,null);assert.equal(availability.observedHTTPStatus,403);assert.equal(availability.phase,'body')
})
test('nativeRecoveryfalse preserves a typed request timeout with no fabricated denial or zero inventory',async()=>{
 const r=replay(url=>url===HOMEPAGE_URL?new Promise(()=>{}):null)
 await assert.rejects(r.run({nativeRecovery:false}),e=>e.name==='TimeoutError'&&e.cause.code==='RENEWBUY_REQUEST_TIMEOUT'&&e.status===undefined&&e.requestUrl===HOMEPAGE_URL&&e.inventoryEvidence.reportedTotal===null)
 assert.deepEqual(r.calls,[HOMEPAGE_URL])
})
test('opaque caller Symbol abort wins during an uncooperative preflight and cannot launch native reads',async()=>{
 const c=new AbortController(),reason=Symbol('exact caller reason'),r=replay(url=>{if(url===HOMEPAGE_URL){queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})}})
 await assert.rejects(r.run({signal:c.signal}),e=>e===reason);assert.deepEqual(r.calls,[HOMEPAGE_URL])
})
test('aggregate expiry wins over a later local deadline without starting native recovery',async()=>{
 const r=replay(url=>url===HOMEPAGE_URL?new Promise(()=>{}):null)
 await assert.rejects(r.run({timeoutMs:10,requestTimeoutMs:500}),e=>e.name==='TimeoutError'&&/aggregate/.test(e.message))
 assert.deepEqual(r.calls,[HOMEPAGE_URL])
})
test('late headers from a timed-out corporate read are cancelled without late source continuation',async()=>{
 let finish,cancelled=false;const r=replay(url=>url===HOMEPAGE_URL?new Promise(resolve=>{finish=resolve}):null)
 const jobs=await r.run(),count=r.calls.length
 finish({url:HOMEPAGE_URL,status:403,headers:new Headers(),body:{cancel(){cancelled=true;return Promise.resolve()}}})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true);assert.equal(r.calls.length,count);assert.equal(jobs.length,3)
})
for(const status of [200,503])test('corporate HTTP'+status+' remains fatal instead of using timeout recovery',async()=>{
 const r=replay(url=>url===HOMEPAGE_URL?{url,status,headers:new Headers(),body:new Response(status===200?'<h1>Changed RenewBuy careers</h1>':'Service unavailable').body}:null)
 await assert.rejects(r.run(),/official surface changed/);assert.deepEqual(r.calls,[HOMEPAGE_URL])
})
for(const status of [200,503])test('corporate HTTP'+status+' headers cannot become recoverable when its body stalls',async()=>{
 let cancelled=false
 const r=replay(url=>url===HOMEPAGE_URL?{url,status,headers:new Headers(),body:new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}})}:null)
 await assert.rejects(r.run(),/official surface changed/);assert.deepEqual(r.calls,[HOMEPAGE_URL]);assert.equal(cancelled,true)
})

test('caller abort before the scheduled fetch invokes no transport callback',async()=>{
 const c=new AbortController(),reason=Symbol('prelaunch'),r=replay(),pending=r.run({signal:c.signal});c.abort(reason)
 await assert.rejects(pending,e=>e===reason);assert.deepEqual(r.calls,[])
})

test('caller abort during a corporate body read cancels it with the exact opaque reason and stops collection',async()=>{
 const c=new AbortController(),reason=Symbol('body abort');let cancelled
 const r=replay(url=>url===HOMEPAGE_URL?{url,status:403,headers:new Headers(),body:new ReadableStream({pull(){queueMicrotask(()=>c.abort(reason));return new Promise(()=>{})},cancel(value){cancelled=value}})}:null)
 await assert.rejects(r.run({signal:c.signal}),e=>e===reason);assert.equal(cancelled,reason);assert.deepEqual(r.calls,[HOMEPAGE_URL])
})

test('aggregate expiry cancels a pending body and does not later start native recovery',async()=>{
 let cancelled
 const r=replay(url=>url===HOMEPAGE_URL?{url,status:403,headers:new Headers(),body:new ReadableStream({pull(){return new Promise(()=>{})},cancel(value){cancelled=value}})}:null)
 await assert.rejects(r.run({timeoutMs:10,requestTimeoutMs:500}),e=>e.name==='TimeoutError'&&/aggregate/.test(e.message))
 await new Promise(resolve=>setTimeout(resolve,30));assert.match(cancelled.message,/aggregate/);assert.deepEqual(r.calls,[HOMEPAGE_URL])
})
test('changed corporate authority remains fatal before native recovery',async()=>{
 const r=replay(url=>url===HOMEPAGE_URL?{url:'https://unrelated.example/',status:403,headers:new Headers(),body:new Response('Forbidden').body}:null)
 await assert.rejects(r.run(),/authority changed/);assert.deepEqual(r.calls,[HOMEPAGE_URL])
})
test('native profile503 still fails after a corporate timeout; no native board read',async()=>{
 const r=replay(url=>url===HOMEPAGE_URL?new Promise(()=>{}):url===PROFILE_URL?{url,status:503,headers:new Headers(),body:new Response('Unavailable').body}:null)
 await assert.rejects(r.run(),e=>e.status===503&&e.requestUrl===PROFILE_URL);assert.equal(r.calls.includes(JOBS_URL),false)
})
test('a native board timeout remains fatal and cannot produce partial or empty success',async()=>{
 const r=replay(url=>url===JOBS_URL?new Promise(()=>{}):null)
 await assert.rejects(r.run(),e=>e.name==='TimeoutError'&&e.requestUrl===JOBS_URL&&e.status===undefined&&e.abortRetries===true)
 assert.equal(r.calls.filter(url=>url===JOBS_URL).length,1)
})
