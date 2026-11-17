import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
let wire=async()=>{throw Error('Uncaptured network disabled')};mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{const p=structuredClone(fixture.originals[i++%fixture.originals.length]);assert.equal(url,p.requestedURL);if(init.redirect!==undefined)assert.equal(init.redirect,'manual');change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('Skill-Lync current declared jobs301 closes education/learner programmes with unknown employer inventory',async()=>{
 const io=replay();wire=io.fetchImpl;const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs)
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),12);assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.nativeCollectionEvidence.fullNativeClosingEqual,true);assert.equal(jobs.nativeCollectionEvidence.observedEmployerVacancyCount,null)
})
test('current native jobs redirect requires exact301 and literal target on every receipt',async()=>{
 for(const change of [p=>{p.status=200},p=>{p.status=302},p=>{p.headers.location='https://example.org/'}]){const io=replay((p,i)=>{if(i===1)change(p)});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}));assert.equal(io.reads(),1)}
})
test('actual whole publisher differences remain explicit unknown inventory without normalization or zero promotion',async()=>{
 const actual=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-home-variation-20261117.json.gz',import.meta.url)))).originals[0],io=replay((p,i)=>{if(i===8)p.bodyBase64=actual.bodyBase64}),jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),a=jobs.nativeCollectionEvidence
 assert.equal(a.fullNativeClosingEqual,false);assert.equal(a.allRawDifferencesRemainUnqualified,true);assert.notEqual(a.originalModels.opening.home.body,a.originalModels.closing.home.body);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(jobs.length,0)
})
test('unreviewed education programmes or newly declared employer hiring links stop acquisition',async()=>{
 for(const at of [2,6]){const io=replay((p,i)=>{if(i===at){let body=Buffer.from(p.bodyBase64,'base64').toString();body+=at===2?'<a href="/new-native-careers">Careers</a>':'// changed programme';p.bodyBase64=Buffer.from(body).toString('base64')}});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}));assert.equal(io.reads(),at)}
})
test('final synchronous metadata attachment retains caller and local deadline ownership',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'skill-final'}),io=replay(),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const clockMock=mock.method(performance,'now',()=>clock()+offset),defineMock=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const result=define(object,key,descriptor);if(Array.isArray(object)&&key==='nativeCollectionEvidence'&&descriptor.value?.acquisition){if(cancel)caller.abort(reason);else offset=5000}return result});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),error=>cancel?error===reason:error.name==='TimeoutError');assert.equal(io.reads(),12)}finally{defineMock.mock.restore();clockMock.mock.restore()}}
})
