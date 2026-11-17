import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
function replay(){const calls=[];const row=url=>fixture.responses.find(r=>(r.requestedURL??r.requestedUrl)===url)||fixture.responses.find(r=>(r.url??r.finalUrl)===url);return {calls,fetchImpl:async(url,init)=>{const r=row(String(url));assert.ok(r,'No source-backed original for '+url);assert.equal(init.body,undefined);calls.push(String(url));return Object.defineProperty(new Response(Buffer.from(r.bodyBase64,'base64'),{status:r.status,headers:r.headers}),'url',{value:r.url??r.finalUrl})},fetchPage:async url=>{const r=row(url);assert.ok(r);calls.push(url);const body=Buffer.from(r.bodyBase64,'base64').toString();return {url:r.url??r.finalUrl,status:r.status,headers:r.headers,html:body,body}}}}
test('HPCL current actual native originals retain 4 canonical observations with explicit qualification and unknown company scope',async t=>{
 const r=replay();t.mock.method(globalThis,'fetch',r.fetchImpl);const jobs=await run({fetchImpl:r.fetchImpl,fetchPage:r.fetchPage}),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.observedRecordCount,4);assert.equal(audit.observedVacancyCount,0);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.ok(audit.nativeOpening&&audit.nativeClosing)
 assert.ok(audit.observations.every(r=>r.country===null&&r.individualVacancyQualified===false));assert.ok(audit.observations.some(r=>r.nativeText.includes('20th July 2026')));assert.equal(audit.nativeAdvertisementDocumentsRead,true);assert.equal(audit.nativeOpening.documents.length,6);assert.ok(audit.nativeOpening.documents.every(d=>d.bodyBase64&&d.sha256&&d.nativeTextCompletenessQualified===false));assert.equal(audit.advertisementCriteriaQualified,false)
})
test('HPCL exact frozen caller pre-abort precedes invalid output limits and acquisition',async t=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'hpcl-preabort'});controller.abort(reason);let calls=0;t.mock.method(globalThis,'fetch',()=>{calls++;assert.fail('No real network in regression')})
 await assert.rejects(run({signal:controller.signal,maxJobs:0,fetchImpl:async()=>{calls++;assert.fail('No acquisition after caller abort')}}),error=>error===reason);assert.equal(calls,0)
})

test('hpcl caller abort during final native audit attachment remains exact after all synchronous model work',async t=>{
 const c=new AbortController(),reason=Object.freeze({owner:'hpcl-final-audit'}),original=Object.defineProperty,r=replay();let triggered=false
 t.mock.method(Object,'defineProperty',function(target,key,descriptor){const value=Reflect.apply(original,Object,[target,key,descriptor]);if(Array.isArray(target)&&key==='nativeCollectionEvidence'&&Object.hasOwn(descriptor.value??{},'nativeOpening')){triggered=true;c.abort(reason)}return value})
 t.mock.method(globalThis,'fetch',async()=>assert.fail('Source-backed callback only; no real network'))
 await assert.rejects(run({signal:c.signal,fetchImpl:r.fetchImpl}),e=>e===reason);assert.equal(triggered,true)
})
