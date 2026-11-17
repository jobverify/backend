import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
function replay(){const calls=[];const row=url=>fixture.responses.find(r=>(r.requestedURL??r.requestedUrl)===url)||fixture.responses.find(r=>(r.url??r.finalUrl)===url);return {calls,fetchImpl:async(url,init)=>{const r=row(String(url));assert.ok(r,'No source-backed original for '+url);assert.equal(init.body,undefined);calls.push(String(url));return Object.defineProperty(new Response(Buffer.from(r.bodyBase64,'base64'),{status:r.status,headers:r.headers}),'url',{value:r.url??r.finalUrl})},fetchPage:async url=>{const r=row(url);assert.ok(r);calls.push(url);const body=Buffer.from(r.bodyBase64,'base64').toString();return {url:r.url??r.finalUrl,status:r.status,headers:r.headers,html:body,body}}}}
test('SGBI current actual native originals retain 7 canonical observations with explicit qualification and unknown company scope',async t=>{
 const r=replay();t.mock.method(globalThis,'fetch',r.fetchImpl);const jobs=await run({fetchImpl:r.fetchImpl,fetchPage:r.fetchPage}),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,1);assert.equal(audit.observedRecordCount,7);assert.equal(audit.observedVacancyCount,7);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.ok(audit.nativeOpening&&audit.nativeClosing)
 assert.equal(jobs[0].country,'India');assert.equal(jobs[0].requisitionId,'5278');assert.match(jobs[0].jobDescription,/RTOS/);assert.equal(jobs[0].postingDate,'2025-08-02T04:23:54+00:00');assert.equal(audit.observations.filter(r=>r.country===null).length,6)
})
test('SGBI exact frozen caller pre-abort precedes invalid output limits and acquisition',async t=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'sastraroboticssgbiinc-preabort'});controller.abort(reason);let calls=0;t.mock.method(globalThis,'fetch',()=>{calls++;assert.fail('No real network in regression')})
 await assert.rejects(run({signal:controller.signal,maxJobs:0,fetchImpl:async()=>{calls++;assert.fail('No acquisition after caller abort')}}),error=>error===reason);assert.equal(calls,0)
})

test('sastraroboticssgbiinc caller abort during final native audit attachment remains exact after all synchronous model work',async t=>{
 const c=new AbortController(),reason=Object.freeze({owner:'sastraroboticssgbiinc-final-audit'}),original=Object.defineProperty,r=replay();let triggered=false
 t.mock.method(Object,'defineProperty',function(target,key,descriptor){const value=Reflect.apply(original,Object,[target,key,descriptor]);if(Array.isArray(target)&&key==='nativeCollectionEvidence'&&Object.hasOwn(descriptor.value??{},'nativeOpening')){triggered=true;c.abort(reason)}return value})
 t.mock.method(globalThis,'fetch',async()=>assert.fail('Source-backed callback only; no real network'))
 await assert.rejects(run({signal:c.signal,fetchImpl:r.fetchImpl}),e=>e===reason);assert.equal(triggered,true)
})
