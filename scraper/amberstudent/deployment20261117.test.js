import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261117.json.gz',import.meta.url))))
const replay=(edit=(p,s)=>s)=>{
 const counts=new Map()
 return {requestIntervalMs:0,now:()=>fixture.now,fetchImpl:async(input,init)=>{
  const url=String(input),packet=fixture.responses.find(p=>p.requestedURL===url)
  assert.ok(packet,'Only current original declared URLs '+url);assert.equal(init.method,'GET')
  const count=(counts.get(url)||0)+1;counts.set(url,count)
  const body=edit(packet,Buffer.from(packet.bodyBase64,'base64').toString(),count)
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }}
}
test('Amber current AboutUs redirect-only release retains dynamic15-row native inventory and8country-qualified roles',async()=>{
 const jobs=await run(replay())
 assert.equal(jobs.length,8);assert.equal(readSourceObservationEvidence(jobs,'amberstudent').observedRecordCount,15)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceClosingQualified&&j.nativeSourceRecord.description&&j.nativeClosingRecord))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(jobs.nativeCollectionEvidence.nativeOpeningInventory.length,15)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
})
test('Amber finite current tuple rejects changed current program and changed full unselected native closing model',async()=>{
 await assert.rejects(run(replay((p,s)=>p.requestedURL.includes('/main.')?s+';unreviewedOverride()':s)),/current|profile|handoff|module/i)
 await assert.rejects(run(replay((p,s,count)=>{
  if(p.requestedURL.includes('/active/')&&count===2){const rows=JSON.parse(s);rows.at(-1).UnknownPublicRequirement='changed';return JSON.stringify(rows)}return s
 })),/closing.*(?:model|inventory)/i)
})
