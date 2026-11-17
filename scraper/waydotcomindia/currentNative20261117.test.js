import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
let wire=async()=>{throw Error('Uncaptured network forbidden')};mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
export const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{const p=structuredClone(fixture.originals[i++%fixture.originals.length]);assert.equal(url,p.requestedURL);if(init.redirect!==undefined)assert.equal(init.redirect,'manual');change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('waydotcomindia current original contract preserves native evidence and genuine holds',async()=>{
 const io=replay();wire=io.fetchImpl;
 await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=>e.status===403&&e.failureKind==='blocked_or_access_denied'&&e.nativeCollectionEvidence?.sourceScopeComplete===false);assert.equal(io.reads(),1)
})

test('failed HTTP audit attachment preserves exact caller ownership and observed HTTP over local source expiry',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'waydotcomindia-failed-audit'}),io=replay((p)=>{p.status=403}),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const cm=mock.method(performance,'now',()=>clock()+offset),dm=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const result=define(object,key,descriptor);if(key==='nativeCollectionEvidence'&&descriptor.value?.failedAcquisition){if(cancel)caller.abort(reason);else offset=5000}return result});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=>cancel?e===reason:e.status===403&&e.failureKind==='blocked_or_access_denied');assert.equal(io.reads(),1)}finally{dm.mock.restore();cm.mock.restore()}}
})
test('legacy body-only callbacks cannot publish jobs, bypass denials or guess inventory',async()=>{
 let reads=0;for(const key of ['fetchText','fetchJson','fetchPage','fetchProtocolTolerantText'])await assert.rejects(source.run({[key]:async()=>{reads++;return '<h1>Careers India</h1>'}}),/metadata-free legacy callback/);assert.equal(reads,0)
})
test('newly accessible unreviewed200 cannot become zero inventory or trigger legacy jobs API',async()=>{
 const io=replay(p=>{p.status=200});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=>/newly accessible/.test(e.message)&&e.nativeCollectionEvidence.observedModel.originalBody.includes('Cloudflare'));assert.equal(io.reads(),1)
})
