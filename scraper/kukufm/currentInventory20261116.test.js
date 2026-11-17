import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {clock,fixture as previous,profile,sha} from './fixtures/replayNativeData20261115.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const compressed=fs.readFileSync(new URL('./fixtures/native-data-20261116.json.gz',import.meta.url))
const inventory=JSON.parse(fs.readFileSync(new URL('./reviewedNativeInventory20261116.json',import.meta.url)))
assert.equal(sha(compressed),inventory.provenance.fixtureSHA256)
const fixture=JSON.parse(gunzipSync(compressed)),listingURLs=new Set(profile.listingPages.map(p=>p.requestedURL))
function replay(change=(entity)=>entity){
 const calls=[],uses=new Map()
 return {calls,options:{now:()=>fixture.startedAt,fetchImpl:async(url,options)=>{
  const count=uses.get(url)||0;uses.set(url,count+1)
  const packet=fixture.entities.filter(p=>p.requestedURL===url)[count];assert.ok(packet,`Missing current original Kuku packet ${url} #${count+1}`)
  const original=Buffer.from(packet.rawBodyBase64,'base64');assert.equal(sha(original),packet.sha256)
  const entity=change({...packet,bytes:original},{url,count})
  calls.push({url,count})
  const response=new Response(entity.bytes,{status:entity.status,headers:{'content-type':entity.contentType}})
  Object.defineProperties(response,{url:{value:entity.finalURL},redirected:{value:entity.redirected}})
  return response
 }}}
}

test('current native77-row inventory closes all48 originals and retains only the same six complete criteria-data roles',async t=>{
 const io=replay(),jobs=await clock(t,()=>run(io.options))
 assert.equal(io.calls.length,48);assert.equal(jobs.length,6)
 assert.deepEqual(jobs.map(j=>Number(j.jobId)),profile.reviewedSelectedRoles.map(r=>r.id))
 assert.ok(!jobs.some(j=>j.jobId==='428573'))
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.observedRecordCount,77);assert.equal(audit.unhydratedNativeRecordCount,71)
 assert.deepEqual(audit.opening,audit.closing)
 assert.equal(audit.nativeInventoryPairComplete,true)
 assert.equal(audit.observations.find(r=>r.id===428573).qualified,false)
 assert.ok(jobs.every(j=>j.applyUrl===null&&j.sourceCorporateBindingQualified===false&&j.sourceRenderedCriteriaComplete===false&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const [name,change]of[
 ['unreviewed native row',page=>{page.results[0].title+=' changed'}],
 ['unreviewed count',page=>{page.count=78}],
 ['unreviewed country',page=>{page.results[0].country='Unknown'}],
 ['unreviewed order',page=>{page.results.reverse()}],
])test('new finite inventory still holds '+name,async t=>{
 const first=profile.listingPages[0].requestedURL
 const io=replay((entity,{url})=>{
  if(url!==first)return entity
  const page=JSON.parse(entity.bytes);change(page);return{...entity,bytes:Buffer.from(JSON.stringify(page))}
 })
 await assert.rejects(clock(t,()=>run(io.options)),/Complete ordered native page\/count\/row\/pagination model changed/)
})

test('current opening77-row inventory cannot close against the genuine previous76-row inventory',async t=>{
 const io=replay((entity,{url,count})=>{
  if(count!==1||!listingURLs.has(url))return entity
  const old=previous.entities.find(p=>p.originalReceipt.requestedURL===url)
  return{...entity,bytes:Buffer.from(old.rawBodyBase64,'base64')}
 })
 await assert.rejects(clock(t,()=>run(io.options)),/Closing complete native board\/inventory\/order changed/)
})
