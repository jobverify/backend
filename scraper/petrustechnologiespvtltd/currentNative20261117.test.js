import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
let wire=async()=>{throw Error('Uncaptured network disabled')};mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
export const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{const p=structuredClone(fixture.originals[i++%fixture.originals.length]);assert.equal(url,p.requestedURL);if(init.redirect!==undefined)assert.equal(init.redirect,'manual');change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('petrustechnologiespvtltd current declared native cohort preserves unknown country/application/company inventory',async()=>{
 const io=replay();wire=io.fetchImpl;const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),4);assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false)
 assert.equal(a.fullNativeClosingEqual,true);assert.equal(a.observedEmployerVacancyCount,null)
})

test('full final native entity changes cannot pass current closing/profile guards',async()=>{
 const io=replay((p,i)=>{if(i===4)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+' ').toString('base64')});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/closing|profile|module|changed/);assert.equal(io.reads(),4)
})
test('final synchronous audit attachment preserves exact caller and local deadline ownership',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'petrustechnologiespvtltd-final'}),io=replay(),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const clockMock=mock.method(performance,'now',()=>clock()+offset),defineMock=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const result=define(object,key,descriptor);if(Array.isArray(object)&&key==='nativeCollectionEvidence'&&descriptor.value?.acquisition){if(cancel)caller.abort(reason);else offset=5000}return result});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),error=>cancel?error===reason:error.name==='TimeoutError');assert.equal(io.reads(),4)}finally{defineMock.mock.restore();clockMock.mock.restore()}}
})
