import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))).originals
mock.method(globalThis,'fetch',async()=>{throw Error('Network disabled in original fixture tests')})
const replay=change=>{let i=0;return {reads:()=>i,fetchImpl:async(url,init)=>{assert.equal(init.redirect,'manual');const p=structuredClone(originals[i++%4]);assert.equal(url,p.requestedURL);change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('current declared careers and two own programs reconcile all bytes without company/India zero',async()=>{
 const io=replay(),jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs)
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),8);assert.equal(e.status,'discovery-only');assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const a=jobs.nativeCollectionEvidence;assert.equal(a.advertisedEmptyState,'No open roles right now .');assert.equal(a.fullPublisherClosingEqual,true);assert.equal(a.fullOwnProgramClosingEqual,true);assert.equal(a.employerWideScopeQualified,false);assert.ok(a.holds.includes('unqualified-third-party-rendering-and-employer-wide-inventory'))
})
test('new cards beside explicit empty text and closing program/model changes remain held',async()=>{
 for(const target of [2,6,8]){const io=replay((p,i)=>{if(i===target)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+'<a href="/careers/engineer">Apply now</a>').toString('base64')});await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/profile|closing|criteria/i)}
})
test('legacy body callback does not promote historical newsletter state to complete inventory',async()=>{await assert.rejects(run({fetchPage:async()=>({status:200,html:'No open roles right now'})}),/metadata|unsupported/i)})
