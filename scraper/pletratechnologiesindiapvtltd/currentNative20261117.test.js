import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
let wire=async()=>{throw Error('Uncaptured network disabled')};mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
export const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{const p=structuredClone(fixture.originals[i++%fixture.originals.length]);assert.equal(url,p.requestedURL);if(init.redirect!==undefined)assert.equal(init.redirect,'manual');change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('pletratechnologiesindiapvtltd current declared native cohort preserves unknown country/application/company inventory',async()=>{
 const io=replay();wire=io.fetchImpl;const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),6);assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false)
 const o=readSourceObservationEvidence(jobs,'pletratechnologiesindiapvtltd');assert.equal(o.observedRecordCount,3);assert.equal(o.observedVacancyCount,3);assert.equal(o.recordKind,'vacancy-rows');assert.equal(a.fullNativeCriteriaClosingEqual,true);assert.ok(a.records.every(r=>r.nativeId&&r.sourceDescription&&r.originalModel&&r.jobId===null&&r.requisitionId===null));assert.ok(a.records.every(r=>r.nativeIdKind==='publisher-dom-accordion-title-id'&&/^elementor-tab-title-\d+$/.test(r.nativeId)));assert.equal(a.records[1].country,null);assert.equal(a.records[1].city,null);assert.equal(a.records[2].country,'Belgium');assert.ok(a.records.every(r=>r.sourceApplicationQualified===false))
})

test('full final native entity changes cannot pass current closing/profile guards',async()=>{
 const io=replay((p,i)=>{if(i===6)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+' ').toString('base64')});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/closing|profile|module|changed/);assert.equal(io.reads(),6)
})
test('current criteria country and native identity conflicts across original HTML/API remain held',async()=>{
 for(const [from,to]of [['Location- Pune','Location- India'],['elementor-tab-title-2362','elementor-tab-title-2361'],['3+ years of experience as a Salesforce trainer','8+ years of experience as a Salesforce trainer']]){const io=replay((p,i)=>{if(i===3){const model=JSON.parse(Buffer.from(p.bodyBase64,'base64').toString()),before=model.content.rendered;model.content.rendered=before.replaceAll(from,to);assert.notEqual(model.content.rendered,before);p.bodyBase64=Buffer.from(JSON.stringify(model)).toString('base64')}});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}));assert.equal(io.reads(),3)}
})
test('typed native authored role data can change coherently without freezing current titles',async()=>{
 const io=replay((p,i)=>{if(i%3===2){const b=Buffer.from(p.bodyBase64,'base64').toString();p.bodyBase64=Buffer.from(b.replaceAll('Business Development Manger','Business Development Manager')).toString('base64')}else if(i%3===0){const j=JSON.parse(Buffer.from(p.bodyBase64,'base64').toString());j.content.rendered=j.content.rendered.replaceAll('Business Development Manger','Business Development Manager');p.bodyBase64=Buffer.from(JSON.stringify(j)).toString('base64')}}),jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0});assert.equal(jobs.nativeCollectionEvidence.records[0].title,'Business Development Manager');assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'pletratechnologiesindiapvtltd').observedRecordCount,3)
})
test('whole raw publisher differences remain explicit holds while the exact native criteria cohort reconciles',async()=>{
 const io=replay((p,i)=>{if(i===5)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+'<!-- complete original changed -->').toString('base64')}),jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),a=jobs.nativeCollectionEvidence
 assert.equal(a.fullNativeClosingEqual,false);assert.equal(a.fullNativeCriteriaClosingEqual,true);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(jobs.length,0)
})
test('final synchronous audit attachment preserves exact caller and local deadline ownership',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'pletratechnologiesindiapvtltd-final'}),io=replay(),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const clockMock=mock.method(performance,'now',()=>clock()+offset),defineMock=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const result=define(object,key,descriptor);if(Array.isArray(object)&&key==='nativeCollectionEvidence'&&descriptor.value?.acquisition){if(cancel)caller.abort(reason);else offset=5000}return result});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),error=>cancel?error===reason:error.name==='TimeoutError');assert.equal(io.reads(),6)}finally{defineMock.mock.restore();clockMock.mock.restore()}}
})
