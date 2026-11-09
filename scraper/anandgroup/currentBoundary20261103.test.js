import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run as runGroup} from './script.js'
import {run as runIndia} from '../anandgroupindia/script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
globalThis.fetch=()=>{throw Error('Offline ANAND source boundary tripwire')}
const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url)))),pages=new Map(packets.map(packet=>[packet.url,packet]))
for(const[source,run]of[['anandgroup',runGroup],['anandgroupindia',runIndia]]){
 test(source+' current generic group hiring entry retains unknown vacancy/country totals and original source ID',async()=>{
  const calls=[];let audit
  const jobs=await run({fetchPage:async url=>{calls.push(url);assert.ok(pages.has(url),'only currently declared public entry URL');return structuredClone(pages.get(url))},onAudit:value=>{audit=value}})
  assert.equal(jobs.length,0);assert.equal(calls.length,4);assert.equal(audit.source,source);assert.equal(audit.observations[0].source,source);assert.equal(audit.observations[0].kind,'general-group-hiring-entry');assert.equal(audit.observations[0].country,null)
  assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.inventoryDelegationComplete,false);assert.equal(audit.privateApplicationRequests,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.ok(!calls.some(url=>/sitemap|robots|salesforce|submit|jobs$|current-openings/.test(url)))
 })
 test(source+' exact caller cancellation makes no public or private request',async()=>{
  const controller=new AbortController(),reason=Object.freeze({caller:source});controller.abort(reason);let calls=0
  await assert.rejects(run({signal:controller.signal,fetchPage:async()=>{calls++;throw Error('unreachable')}}),error=>error===reason);assert.equal(calls,0)
 })
 test(source+' typed first denial stays local without route probing or fallback',async()=>{
  let calls=0;await assert.rejects(run({fetchPage:async url=>{calls++;return{status:403,url,html:'Denied'}}}),error=>error.status===403&&error.abortRetries&&!error.abortPipeline);assert.equal(calls,1)
 })
}
test('ANAND private application controls never become public inventory prerequisites',async()=>{
 let audit;const jobs=await runGroup({fetchPage:async url=>{const packet=structuredClone(pages.get(url));assert.ok(packet);packet.html=packet.html.replace(/<input\b[^>]*>/gi,'');return packet},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(audit.observations[0].kind,'general-group-hiring-entry');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('ANAND ignoring observer is bounded and inert native entry markup is held',async()=>{
 let called=false;await assert.rejects(runGroup({collectionBudgetMs:120,fetchPage:async url=>structuredClone(pages.get(url)),onAudit:()=>{called=true;return new Promise(()=>{})}}),error=>error.code==='ANAND_COLLECTION_TIMEOUT');assert.equal(called,true)
 await assert.rejects(runGroup({fetchPage:async url=>{const packet=structuredClone(pages.get(url));packet.html='<template>'+packet.html+'</template>';return packet}}))
})
