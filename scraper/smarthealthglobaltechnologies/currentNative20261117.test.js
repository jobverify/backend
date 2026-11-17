import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
let wire=async()=>{throw Error('Uncaptured network forbidden')};mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
export const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{const p=structuredClone(fixture.originals[i++%fixture.originals.length]);assert.equal(url,p.requestedURL);if(init.redirect!==undefined)assert.equal(init.redirect,'manual');change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('smarthealthglobaltechnologies actual declared current native cohort retains employer-country-criteria-inventory holds',async()=>{
 const io=replay();wire=io.fetchImpl;const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence;assert.deepEqual(jobs,[]);assert.equal(io.reads(),8);assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false);
 assert.equal(readSourceObservationEvidence(jobs,'smarthealthglobaltechnologies'),null);assert.equal(a.observedEmployerVacancyCount,null)
})

test('failed HTTP audit retains exact caller reason and observed status over local expiry',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'smarthealthglobaltechnologies-error-audit'}),io=replay(p=>{p.status=403}),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const cm=mock.method(performance,'now',()=>clock()+offset),dm=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const r=define(object,key,descriptor);if(key==='nativeCollectionEvidence'&&descriptor.value?.failedAcquisition){if(cancel)caller.abort(reason);else offset=5000}return r});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=>cancel?e===reason:e.status===403&&e.failureKind==='blocked_or_access_denied');assert.equal(io.reads(),1)}finally{dm.mock.restore();cm.mock.restore()}}
})
test('final successful audit rechecks exact caller and source deadline ownership',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'smarthealthglobaltechnologies-success-audit'}),io=replay(),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const cm=mock.method(performance,'now',()=>clock()+offset),dm=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const r=define(object,key,descriptor);if(Array.isArray(object)&&key==='nativeCollectionEvidence'&&descriptor.value?.acquisition){if(cancel)caller.abort(reason);else offset=5000}return r});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=>cancel?e===reason:e.name==='TimeoutError');assert.equal(io.reads(),8)}finally{dm.mock.restore();cm.mock.restore()}}
})
test('metadata-free legacy callbacks cannot supply roles or successful zero inventory',async()=>{let reads=0;for(const key of ['fetchText','fetchJson','fetchPage','fetchProtocolTolerantText'])await assert.rejects(source.run({[key]:async()=>{reads++;return 'Apply now India'}}),/metadata-free legacy callback/);assert.equal(reads,0)})
test('complete closing declared executable or CSS bytes cannot silently change',async()=>{const io=replay((p,i)=>{if(i===8)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+' ').toString('base64')});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/programme|CSS|changed/);assert.equal(io.reads(),8)})
test('whole raw publisher changes retain the actual source closing disposition',async()=>{
 const io=replay((p,i)=>{if(i===6)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+'<!-- whole raw difference -->').toString('base64')});const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0});assert.equal(jobs.nativeCollectionEvidence.fullNativeClosingEqual,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('legacy bridge does not grant foreign publisher authority or start guessed career probes',async()=>{const io=replay((p,i)=>{if(i===1)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString().replaceAll('https://shgtechnologies.com','https://example.org')).toString('base64')});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/bridge changed/);assert.equal(io.reads(),1)})
