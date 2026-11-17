import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,runStandalone} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
mock.method(globalThis,'fetch',async()=>{throw Error('Uncaptured network disabled in source-backed tests')})
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))).originals[0]
const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{assert.equal(init.redirect,'manual');const p=structuredClone(original);assert.equal(url,p.requestedURL);i++;change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('current unbranded ComingSoon carrier closes with unknown employer/inventory and cleanup forbidden',async()=>{
 const io=replay(),jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),2);assert.equal(e.status,'discovery-only');assert.equal(e.firstParty,false);assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(a.fullNativeClosingEqual,true);assert.equal(a.publisherEmployerIdentityQualified,false)
})
test('changed ComingSoon entity and metadata-free historical cards cannot publish',async()=>{
 const io=replay((p,i)=>{if(i===2)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+' changed').toString('base64')});await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/profile|closing/i)
 await assert.rejects(run({fetchText:async()=>''}),/metadata|unsupported/i)
})
test('standalone unknown inventory cannot call a database/file saver',async()=>{
 let calls=0;await assert.rejects(runStandalone({argv:['node','script.js','--dry-run'],fetchText:async()=>'',saveToFile:()=>{calls++},saveToDB:async()=>{calls++}}),/metadata|unsupported|inventory/i);assert.equal(calls,0)
})
