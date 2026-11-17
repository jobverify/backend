import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
let wire=async()=>{throw Error('Uncaptured network forbidden')};mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
export const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{const p=structuredClone(fixture.originals[i++%fixture.originals.length]);assert.equal(url,p.requestedURL);if(init.redirect!==undefined)assert.equal(init.redirect,'manual');change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('sttglobaldatacentresindia current original contract preserves native evidence and genuine holds',async()=>{
 const io=replay();wire=io.fetchImpl;
 const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence;assert.deepEqual(jobs,[]);assert.equal(io.reads(),8);assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false);const o=readSourceObservationEvidence(jobs,'sttglobaldatacentresindia');assert.equal(o.observedRecordCount,1);assert.equal(o.observedVacancyCount,0);assert.equal(a.records[0].country,null);assert.equal(a.records[0].applyUrl,'mailto:careers@sttgdc.in');assert.equal(a.records[0].sourceDetailComplete,false)
})

test('failed HTTP audit attachment preserves exact caller ownership and observed HTTP over local source expiry',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'sttglobaldatacentresindia-failed-audit'}),io=replay((p)=>{p.status=403}),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const cm=mock.method(performance,'now',()=>clock()+offset),dm=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const result=define(object,key,descriptor);if(key==='nativeCollectionEvidence'&&descriptor.value?.failedAcquisition){if(cancel)caller.abort(reason);else offset=5000}return result});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=>cancel?e===reason:e.status===403&&e.failureKind==='blocked_or_access_denied');assert.equal(io.reads(),1)}finally{dm.mock.restore();cm.mock.restore()}}
})
test('legacy body-only callbacks cannot publish jobs, bypass denials or guess inventory',async()=>{
 let reads=0;for(const key of ['fetchText','fetchJson','fetchPage','fetchProtocolTolerantText'])await assert.rejects(source.run({[key]:async()=>{reads++;return '<h1>Careers India</h1>'}}),/metadata-free legacy callback/);assert.equal(reads,0)
})
test('final post-audit attachment preserves source deadline and frozen caller reason',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'sttglobaldatacentresindia-success-audit'}),io=replay(),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const cm=mock.method(performance,'now',()=>clock()+offset),dm=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const result=define(object,key,descriptor);if(Array.isArray(object)&&key==='nativeCollectionEvidence'&&descriptor.value?.acquisition){if(cancel)caller.abort(reason);else offset=5000}return result});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=>cancel?e===reason:e.name==='TimeoutError');assert.equal(io.reads(),8)}finally{dm.mock.restore();cm.mock.restore()}}
})
test('entire current native programme or metadata-shell change remains unreviewed',async()=>{
 const io=replay((p,i)=>{if(i===8)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+' ').toString('base64')});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/programme|shell|changed/);assert.equal(io.reads(),8)
})
test('whole raw publisher inequality remains explicit without job or completeness promotion',async()=>{
 const io=replay((p,i)=>{if(i===5)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+'<!-- raw entity changed -->').toString('base64')}),jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0});assert.equal(jobs.nativeCollectionEvidence.fullNativeClosingEqual,false);assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('current email or complete frame declaration drift cannot silently change handoff authority',async()=>{
 for(const [from,to]of [['mailto:careers@sttgdc.in','mailto:other@example.org'],['https://www.youtube.com/embed/51Td3NbKW0k?si=lHBQyhML999hbmHY','https://example.org/jobs']]){const io=replay((p,i)=>{if(i===3){const b=Buffer.from(p.bodyBase64,'base64').toString();assert.ok(b.includes(from));p.bodyBase64=Buffer.from(b.replace(from,to)).toString('base64')}});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}));assert.equal(io.reads(),3)}
})
