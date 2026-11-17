import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))).originals
mock.method(globalThis,'fetch',async()=>{throw Error('Network disabled in original fixture tests')})
const response=p=>{const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}
const replay=change=>{let i=0;return {reads:()=>i,fetchImpl:async(url,init)=>{assert.equal(init.redirect,'manual');const p=structuredClone(originals[i++%2]);assert.equal(url,p.requestedURL);change?.(p,i);return response(p)}}}
test('actual current exact root301 closes full Mirav marketing bytes with unknown inventory and cleanup hold',async()=>{
 const io=replay(),jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs)
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),4);assert.equal(e.status,'discovery-only');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.fullPublisherClosingEqual,true);assert.equal(jobs.nativeCollectionEvidence.employerWideScopeQualified,false)
})
test('current redirect destination and whole publisher closing cannot drift silently',async()=>{
 for(const change of [(p,i)=>{if(i===1)p.headers.location='https://example.org/'},(p,i)=>{if(i===4)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+'<!-- changed -->').toString('base64')}]){
  const io=replay(change);await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/redirect|closing|profile/i)
 }
})
test('body-only legacy callback cannot certify no jobs',async()=>{await assert.rejects(run({fetchPage:async()=>({status:200,html:'Mirav Labs'})}),/metadata|unsupported/i)})
for(const stage of [1,3])test('captured301 entity served as200 at root remains held on receipt'+stage,async()=>{
 const io=replay((p,i)=>{if(i===stage)p.status=200})
 await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/301/i)
 assert.equal(io.reads(),stage)
})
